import type { RoomId } from '../../game/maps/rooms'
import { INITIAL_CONNECTION, lobbySocketUrl, parseServerMessage, normalizeChat, validChatText } from './model/protocol.ts'
import type { ConnectionInfo, MoveInput, MoveCommand, PlayerState, ChatMessage, ChatError, ChatScope, ServerMessage } from './model/protocol'

type Callbacks = { room?: (roomId: RoomId, pending: boolean) => void; snapshot?: (players: PlayerState[], selfId: string | null, serverTime?: number) => void; status?: (info: ConnectionInfo) => void;
  chat?: (event: ChatMessage) => void; history?: (messages: ChatMessage[]) => void; chatError?: (reason: ChatError) => void; inputSent?: (sequence: number) => void;
  predicted?: (command: MoveCommand) => void }

/**
 * 소켓 상태와 입력 전송을 관리하고 끊김 시 제한된 지수 지연으로 재접속한다.
 *
 * @author seulgae
 * @version 1.0, 단일 소켓의 방 세대 검증·예측 초기화·방별 채팅과 재연결
 * @see "None"
 */
export default class MultiplayerClient {
  private roomId: RoomId = 'lobby'
  private roomEpoch = 0
  private scoped = false
  private travelling = false
  private travelTimer: ReturnType<typeof setTimeout> | undefined
  private socket: WebSocket | null = null
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private inputTimer: ReturnType<typeof setInterval> | undefined
  private disposed = false
  private started = false
  private attempts = 0
  private sequence = 0
  private commandMode = false
  private commands: MoveCommand[] = []
  private lastMovementBatch: MoveCommand[] = []
  private serverTime: number | undefined
  private lastQueuedInput: MoveInput | null = null
  private lastInputSent = -Infinity
  private lastSentInput: MoveInput | null = null
  private lastChatSent = -Infinity
  private chatEnabled = false
  private messages: ChatMessage[] = []
  private readonly seenMessages = new Set<string>()
  private connectedAt = 0
  private recentInputSends: number[] = []
  private lastMessage = 0
  private lastTick = -1
  private selfId: string | null = null
  private input: MoveInput = { x: 0, y: 0 }
  private players = new Map<string, PlayerState>()
  private info = { ...INITIAL_CONNECTION }
  private readonly listeners = new Set<Callbacks>()
  private readonly stopInput = () => this.setInput({ x: 0, y: 0 })
  private readonly onVisibility = () => { if (document.hidden) this.stopInput() }

  constructor(callbacks: Callbacks = {}) { this.listeners.add(callbacks) }

  /** Scene은 구독만 교체하고 React 게임 컴포넌트가 소켓 수명을 소유한다. */
  subscribe(callbacks: Callbacks) {
    this.listeners.add(callbacks)
    try {
      callbacks.room?.(this.roomId, this.travelling)
      callbacks.status?.(this.info)
      callbacks.snapshot?.([...this.players.values()], this.selfId, this.serverTime)
      callbacks.history?.([...this.messages])
    } catch (error) { console.warn('[multiplayer] 구독 초기화 실패', error) }
    return () => { this.listeners.delete(callbacks) }
  }

  private notify(effect: (callbacks: Callbacks) => void) {
    for (const listener of this.listeners) {
      try { effect(listener) } catch (error) { console.warn('[multiplayer] UI/Scene 콜백 실패 (연결 유지)', error) }
    }
  }

  start() {
    if (this.started || this.disposed) return
    this.started = true
    window.addEventListener('blur', this.stopInput)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.connect()
    this.inputTimer = setInterval(() => {
      if (this.socket?.readyState === 1 && Date.now() - this.lastMessage > 10000) this.socket.close(4001, 'Server state timeout')
      else this.sendInput()
    }, 50)
  }

  setInput(input: MoveInput) {
    if (this.input.x === input.x && this.input.y === input.y) return
    this.input = input
    if (this.commandMode && !input.x && !input.y) this.recordStep(input, 0)
    this.sendInput()
  }

  usesCommands() { return this.commandMode && !!this.selfId }

  /**
   * 완료된 물리 스텝만 기록한다. 좌표는 전송하지 않으며 정지 명령은 한 번만 보낸다.
   * @param input 해당 물리 스텝에 사용한 방향
   * @param ms 실제 Arcade 스텝의 밀리초, 정지 명령은 0
   */
  recordStep(input: MoveInput, ms: number) {
    if (this.travelling || !this.usesCommands() || this.socket?.readyState !== 1) return
    if (!input.x && !input.y && !this.lastQueuedInput?.x && !this.lastQueuedInput?.y) return
    if (this.commands.length >= 120) { this.restartMovement(); return }
    const command = { x: input.x, y: input.y, ms: input.x || input.y ? ms : 0, seq: ++this.sequence }
    this.commands.push(command); this.lastQueuedInput = { ...input }
    this.notify(callbacks => callbacks.predicted?.(command))
    this.sendInput()
  }

  /** 10초 이상 확인되지 않은 예측은 무한히 쌓지 않고 새 세션으로 복구한다. */
  restartMovement() { this.socket?.close(4004, 'Movement acknowledgement timeout') }

  private sendInput() {
    const socket = this.socket
    if (this.travelling || !this.selfId || socket?.readyState !== 1) return
    if (this.commandMode) {
      const now = Date.now()
      if (!this.commands.length || now - this.lastInputSent < 50) return
      if (socket.bufferedAmount > 4096) { socket.close(4003, 'Input backpressure'); return }
      this.lastMovementBatch = this.commands.slice(0, 8)
      socket.send(JSON.stringify({ type: 'move', inputs: this.lastMovementBatch, ...(this.scoped ? {roomEpoch:this.roomEpoch} : {}) }))
      this.commands.splice(0, 8); this.lastInputSent = now
      this.recentInputSends = this.recentInputSends.filter(sentAt => now - sentAt < 1000)
      this.recentInputSends.push(now)
      this.notify(callbacks => callbacks.inputSent?.(this.sequence))
      return
    }
    // 정지는 한 번만 알린다. 유휴 연결 유지에는 서버 ping/pong을 사용한다.
    if (this.input.x === 0 && this.input.y === 0 && this.lastSentInput?.x === 0 && this.lastSentInput.y === 0) return
    // 방향 변경과 정기 전송을 합쳐 최대 20Hz로 보낸다. 대기 중에는 최신 방향만 유지한다.
    const now = Date.now()
    if (now - this.lastInputSent < 50) return
    if (socket.bufferedAmount > 4096) { socket.close(4003, 'Input backpressure'); return }
    socket.send(JSON.stringify({ type: 'input', x: this.input.x, y: this.input.y, seq: ++this.sequence, ...(this.scoped ? {roomEpoch:this.roomEpoch} : {}) }))
    this.lastInputSent = now
    this.lastSentInput = { ...this.input }
    this.recentInputSends = this.recentInputSends.filter(sentAt => now - sentAt < 1000)
    this.recentInputSends.push(now)
    this.notify(callbacks => callbacks.inputSent?.(this.sequence))
  }

  /** 이동 sequence나 입력 예산을 소비하지 않는 별도 일반 텍스트 요청이다. */
  sendChat(text: string, scope: ChatScope = 'room') {
    const message = normalizeChat(text)
    const reason: ChatError | null = !this.canChat() ? 'unavailable' : !message ? 'empty'
      : Array.from(message).length > 150 ? 'too_long' : !validChatText(message) ? 'invalid'
      : Date.now() - this.lastChatSent < 1000 ? 'rate_limited' : null
    if (reason) { this.notify(callbacks => callbacks.chatError?.(reason)); return false }
    if (this.socket!.bufferedAmount > 4096) { this.notify(callbacks => callbacks.chatError?.('unavailable')); return false }
    this.lastChatSent = Date.now()
    try { this.socket!.send(JSON.stringify({ type: 'chat', message, ...(scope === 'table' ? { scope } : {}), ...(this.scoped ? {roomEpoch:this.roomEpoch} : {}) })) }
    catch { this.notify(callbacks => callbacks.chatError?.('unavailable')); return false }
    return true
  }

  canChat() { return !this.travelling && this.chatEnabled && !!this.selfId && this.socket?.readyState === 1 }

  currentRoom() { return this.roomId }
  isTravelling() { return this.travelling }
  /** 소켓을 재생성하지 않고 현재 방 세대와 출입구만 요청한다. */
  changeRoom(doorId: string) {
    if (!this.scoped || this.travelling || this.socket?.readyState !== 1 || !this.selfId) return false
    this.setInput({x:0,y:0})
    this.travelling = true
    this.updateStatus({travelling:true, roomError:undefined, message:'방을 이동하고 있어요…'})
    this.notify(c => c.room?.(this.roomId, true))
    this.socket.send(JSON.stringify({type:'room_change', doorId, roomEpoch:this.roomEpoch}))
    this.travelTimer = setTimeout(() => { this.socket?.close(4005, 'Room response timeout') }, 5000)
    return true
  }

  private remember(message: ChatMessage) {
    if (this.seenMessages.has(message.messageId)) return false
    this.seenMessages.add(message.messageId)
    if (this.seenMessages.size > 200) this.seenMessages.delete(this.seenMessages.values().next().value!)
    this.messages = [...this.messages, message].slice(-50)
    return true
  }

  private connect() {
    if (this.disposed) return
    this.updateStatus({ phase: this.attempts ? 'reconnecting' : 'connecting', message: this.attempts ? '연결이 끊겼어요. 다시 연결 중… 혼자 둘러볼 수 있어요.' : '로비 연결 중…' })
    let nickname = this.info.nickname
    // 브라우저 저장소가 차단되어도 익명 접속과 현재 게임은 계속한다.
    try { nickname = sessionStorage.getItem('lab.nickname') ?? nickname } catch { }
    let socket: WebSocket
    try { socket = new WebSocket(lobbySocketUrl(window.location, nickname)) }
    catch { this.retry(); return }
    this.socket = socket
    this.commandMode = false; this.commands = []; this.lastQueuedInput = null
    this.lastMovementBatch = []; this.serverTime = undefined
    this.chatEnabled = false
    this.connectedAt = 0; this.sequence = 0; this.recentInputSends = []
    socket.onopen = () => { this.lastMessage = Date.now() }
    socket.onmessage = event => {
      if (this.disposed || socket !== this.socket) return
      let message: ServerMessage
      // 프로토콜 오류와 렌더링 콜백 오류를 구분한다. UI 예외가 소켓 종료로 이어지지 않게 한다.
      try { message = parseServerMessage(String(event.data)) }
      catch (error) {
        console.warn('[multiplayer] 잘못된 서버 프레임', error)
        socket.close(4002, 'Invalid server frame')
        return
      }
      try {
        this.lastMessage = Date.now()
        if (message.type !== 'welcome' && message.type !== 'room_changed' && message.roomId !== undefined
            && (message.roomId !== this.roomId || message.roomEpoch !== this.roomEpoch)) return
        if (message.type === 'room_error') {
          clearTimeout(this.travelTimer); this.travelling = false
          this.updateStatus({travelling:false, roomError:message.reason, message:message.reason})
          this.notify(c => c.room?.(this.roomId, false)); return
        }
        if (message.type === 'room_changed') {
          if (!this.travelling || message.roomEpoch! <= this.roomEpoch || message.selfId !== this.selfId) return
          clearTimeout(this.travelTimer)
          this.roomId = message.roomId!; this.roomEpoch = message.roomEpoch!; this.travelling = false
          this.sequence = 0; this.lastTick = -1; this.commands = []; this.lastMovementBatch = []; this.lastQueuedInput = null
          this.input = {x:0,y:0}; this.lastSentInput = null; this.lastInputSent = -Infinity; this.serverTime = message.time
          this.messages = []; this.seenMessages.clear(); this.notify(c => c.history?.([]))
          this.players = new Map(message.players.map(p => [p.id,p]))
          this.notify(c => c.snapshot?.([], null))
          this.updateStatus({roomId:this.roomId, roomOnline:this.players.size, travelling:false, roomError:undefined})
          this.notify(c => c.room?.(this.roomId, false))
          this.notify(c => c.snapshot?.([...this.players.values()], this.selfId, this.serverTime))
          return
        }
        if (message.type === 'welcome') {
          this.scoped = message.roomId !== undefined; this.roomId = message.roomId ?? 'lobby'; this.roomEpoch = message.roomEpoch ?? 0
          this.travelling = false; clearTimeout(this.travelTimer)
          this.updateStatus({roomId:this.roomId, travelling:false, roomError:undefined})
          this.notify(c => c.room?.(this.roomId, false))
          this.serverTime = message.time
          this.selfId = message.selfId; this.sequence = 0; this.lastInputSent = -Infinity; this.lastTick = -1; this.attempts = 0
          this.connectedAt = Date.now(); this.recentInputSends = []
          this.lastSentInput = null; this.lastChatSent = -Infinity
          this.chatEnabled = message.protocolVersion === 3 || message.protocolVersion === 4
          this.commandMode = message.protocolVersion === 4; this.commands = []; this.lastQueuedInput = null
          if (new URLSearchParams(window.location.search).get('netDebug') === '1') {
            console.info('[multiplayer] 이동 프로토콜', { version: message.protocolVersion,
              mode: this.commandMode ? 'completed-steps' : 'legacy' })
          }
          this.players = new Map(message.players.map(player => [player.id, player]))
          const own = this.players.get(this.selfId)!
          this.updateStatus({ phase: 'online', nickname: own.nickname, online: this.players.size, message: '로비에 연결됐어요.' })
          try { sessionStorage.setItem('lab.nickname', own.nickname) } catch { }
          this.sendInput()
        } else if (!this.selfId) return
        else if (message.type === 'chat_history') {
          this.messages = []; this.seenMessages.clear()
          for (const entry of message.messages) this.remember(entry)
          this.notify(callbacks => callbacks.history?.([...this.messages]))
          return
        } else if (message.type === 'chat_message') {
          if (this.remember(message)) this.notify(callbacks => callbacks.chat?.(message))
          return
        } else if (message.type === 'chat_error') {
          this.notify(callbacks => callbacks.chatError?.(message.reason))
          return
        }
        else if (message.type === 'state') {
          if (message.tick <= this.lastTick) return
          this.lastTick = message.tick
          this.serverTime = message.time
          this.players = new Map(message.players.map(player => [player.id, player]))
        } else if (message.type === 'joined') this.players.set(message.player.id, message.player)
        else if (message.type === 'left') this.players.delete(message.id)
        this.notify(callbacks => callbacks.snapshot?.([...this.players.values()], this.selfId, this.serverTime))
        this.updateStatus({ online: this.players.size, roomOnline:this.players.size, totalOnline:message.totalOnline ?? this.info.totalOnline })
      } catch (error) {
        console.warn('[multiplayer] 화면 상태 반영 실패 (연결 유지)', error)
      }
    }
    socket.onerror = () => socket.close()
    socket.onclose = event => {
      if (this.disposed || socket !== this.socket) return
      console.warn('[multiplayer] 연결 종료', {
        code: event.code, reason: event.reason, wasClean: event.wasClean,
        sentInputs: this.sequence, connectedMs: this.connectedAt ? Date.now() - this.connectedAt : 0,
        sentLastSecond: this.recentInputSends.filter(sentAt => Date.now() - sentAt < 1000).length,
        lastMovementBatch: this.commandMode ? this.lastMovementBatch : undefined,
        pendingCommands: this.commands.length,
      })
      if (event.code === 1008 && this.commandMode) {
        console.warn('[multiplayer:movement-rejected]', JSON.stringify({ reason: event.reason,
          lastBatch: this.lastMovementBatch, pendingCommands: this.commands.length }))
      }
      socket.onmessage = null; socket.onclose = null; socket.onerror = null; socket.onopen = null
      clearTimeout(this.travelTimer); this.travelling = false
      this.notify(c => c.room?.(this.roomId, false))
      this.socket = null; this.selfId = null; this.players.clear()
      this.commands = []; this.commandMode = false; this.lastQueuedInput = null
      this.notify(callbacks => callbacks.snapshot?.([], null))
      if (event.code === 1008) {
        try { sessionStorage.removeItem('lab.nickname') } catch { }
        this.info.nickname = ''
      }
      this.updateStatus({ phase: 'reconnecting', online: 0, message: event.code === 1013 ? '로비 정원이 가득 찼어요. 잠시 후 다시 연결합니다.' : '연결이 끊겼어요. 다시 연결 중… 혼자 둘러볼 수 있어요.' })
      this.retry()
    }
  }

  private retry() {
    if (this.disposed) return
    clearTimeout(this.retryTimer)
    const delay = Math.min(8000, 500 * 2 ** Math.min(this.attempts++, 4))
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }

  private updateStatus(patch: Partial<ConnectionInfo>) {
    const next = { ...this.info, ...patch }
    if (Object.keys(next).every(key => next[key as keyof ConnectionInfo] === this.info[key as keyof ConnectionInfo])) return
    this.info = next
    this.notify(callbacks => callbacks.status?.(next))
  }

  /** 재시도·입력 타이머와 브라우저 이벤트를 먼저 해제한 뒤 소켓을 닫는다. */
  destroy() {
    this.disposed = true
    clearTimeout(this.travelTimer); clearTimeout(this.retryTimer); clearInterval(this.inputTimer)
    window.removeEventListener('blur', this.stopInput)
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.socket) {
      this.socket.onmessage = null; this.socket.onclose = null; this.socket.onerror = null; this.socket.onopen = null
      this.socket.close()
    }
    this.socket = null; this.players.clear()
    this.commands = []; this.commandMode = false; this.lastQueuedInput = null
    this.listeners.clear(); this.messages = []; this.seenMessages.clear()
  }
}
