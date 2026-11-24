import { ROOMS } from '../../game/maps/rooms.ts'
import type { RoomId } from '../../game/maps/rooms'
import { SOLO_MESSAGE, validGroundItem, INITIAL_CONNECTION, NICKNAME_CLOSE_CODE, REPLACED_CLOSE_CODE, validNickname, REPLACED_MESSAGE, closeCause, lobbySocketUrl, parseServerMessage, normalizeChat, validChatText } from './model/protocol.ts'

/**
 * 운영 경로(Tailscale Funnel)는 요청 왕복이 약 1초, 연결 수립이 3~5초까지 걸린다.
 * 방 이동 응답을 5초만 기다리면 정상 지연에도 스스로 연결을 끊으므로 여유를 둔다.
 */
export const ROOM_RESPONSE_TIMEOUT_MS = 15000
/** 업로드가 잠시 막혀도 바로 끊지 않도록 약 4초 분량의 입력(20Hz)을 허용한다. */
export const INPUT_BACKPRESSURE_BYTES = 16384
/** 멀티플레이는 회의실에서만 연다. 다른 방은 서버 없이 혼자 둘러보고, 방 이동도 바로 한다. */
export const MEETING_ROOM: RoomId = 'meeting-room'
/** 관리자실(관리자 회원만 들어간다. 실제 권한은 서버의 관리자 API가 확인한다) */
export const ADMIN_ROOM: RoomId = 'control-room'
import type { ConnectionInfo, MoveInput, MoveCommand, PlayerState, ChatMessage, ChatError, ChatScope, GroundItem, ServerMessage, TradeOffer, TradeStatus } from './model/protocol'

type Callbacks = { room?: (roomId: RoomId, pending: boolean) => void; snapshot?: (players: PlayerState[], selfId: string | null, serverTime?: number) => void; status?: (info: ConnectionInfo) => void;
  chat?: (event: ChatMessage) => void; history?: (messages: ChatMessage[]) => void; chatError?: (reason: ChatError) => void; inputSent?: (sequence: number) => void;
  predicted?: (command: MoveCommand) => void
  /** 지금 방 바닥 아이템 목록이 바뀌었을 때 */
  ground?: (items: GroundItem[]) => void
  /** 내 가방이 바뀌었을 때(버리기·줍기 성공) */
  inventoryChanged?: () => void
  inventoryError?: (reason: 'login' | 'unavailable') => void
  /** 회의실에서 교환 신청을 받았을 때 */
  tradeOffer?: (offer: TradeOffer) => void
  /** 교환이 진행됐을 때(보냄·맞바꿈·거절·실패) */
  tradeStatus?: (status: TradeStatus) => void }

/**
 * 소켓 상태와 입력 전송을 관리하고 끊김 시 제한된 지수 지연으로 재접속한다.
 *
 * @author seulgae
 * @version 1.0, 단일 소켓의 방 세대 검증·예측 초기화·방별 채팅과 재연결
 * @see "None"
 */
export default class MultiplayerClient {
  private roomId: RoomId
  /** 회의실에 있어 서버 연결을 유지해야 하는지 */
  private online = false
  /** 회의실 문을 열고 연결을 기다리는 중인지(연결되면 회의실로 들어간다) */
  private joining = false
  /** 장면이 알려 주는 내 위치(회의실 밖에서는 서버가 모른다). 버리기·줍기에 쓴다. */
  private position = { x: 400, y: 400 }
  /** 로그인 회원이 관리자인지(관리자실 문) */
  private admin = false
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
  private groundItems: GroundItem[] = []
  private appliedNickname: string | null = null
  private info = { ...INITIAL_CONNECTION }
  private readonly listeners = new Set<Callbacks>()
  private readonly stopInput = () => this.setInput({ x: 0, y: 0 })
  private readonly onVisibility = () => { if (document.hidden) this.stopInput() }

  /** 지금 로그인한 회원이 관리자인지 묻는 함수(화면의 로그인 상태). 문을 열 때마다 묻는다. */
  private readonly isAdmin?: () => boolean

  constructor(callbacks: Callbacks = {}, options: { isAdmin?: () => boolean; initialRoom?: 'lobby' | 'outdoor' } = {}) {
    this.listeners.add(callbacks)
    this.isAdmin = options.isAdmin
    this.roomId = options.initialRoom ?? 'lobby'
    this.info.roomId = this.roomId
  }

  /** Scene은 구독만 교체하고 React 게임 컴포넌트가 소켓 수명을 소유한다. */
  /**
   * 회원 닉네임을 적용한다. 같은 소켓으로는 이름을 바꿀 수 없으므로, 이미 다른 이름으로 접속했다면 바로 다시 접속한다.
   * 모바일처럼 로그인 확인이 게임 시작(2.5초)보다 늦게 끝나면 임시 이름 "연구원-xxxx"로 남던 문제를 막는다.
   * @returns 다시 접속을 시작했으면 true
   */
  applyNickname(nickname: string) {
    // 같은 닉네임은 한 번만 시도한다(서버가 중복이라 "이름-xxxx"로 바꿔 줘도 다시 접속을 반복하지 않는다).
    if (this.disposed || !validNickname(nickname) || nickname === this.info.nickname || nickname === this.appliedNickname) return false
    this.appliedNickname = nickname
    try { sessionStorage.setItem('lab.nickname', nickname) } catch { }
    if (!this.socket || this.socket.readyState > 1) { this.updateStatus({ nickname }); return false }
    this.socket.close(NICKNAME_CLOSE_CODE, 'Nickname updated')
    return true
  }

  /** 내 연구원 id(채팅 알림음에서 내 메시지를 거른다) */
  selfPlayerId() { return this.selfId }

  /** 로그인 상태가 바뀌면 화면이 관리자 여부를 알려 준다. */
  setAdmin(admin: boolean) { this.admin = admin }
  /** 이 방에 들어갈 수 있는지(관리자실은 관리자만) */
  // 로그인 확인이 클라이언트 생성보다 먼저 끝나면 setAdmin이 불리지 않을 수 있어, 문을 열 때 로그인 상태를 직접 묻는다.
  canEnter(target: string) { return target !== ADMIN_ROOM || this.admin || this.isAdmin?.() === true }

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
    // 회의실 밖에서는 연결하지 않는다. 회의실 문을 열 때 연결한다.
    this.enterLocal(this.roomId)
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
      if (socket.bufferedAmount > INPUT_BACKPRESSURE_BYTES) { socket.close(4003, 'Input backpressure'); return }
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
    if (socket.bufferedAmount > INPUT_BACKPRESSURE_BYTES) { socket.close(4003, 'Input backpressure'); return }
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

  /** 의자에 앉거나(seatId) 일어난다(null). 서버가 거리·빈자리를 확인하고 다음 상태의 seat로 결과를 알린다. */
  sit(seatId: string | null) {
    if (!this.scoped || this.travelling || this.socket?.readyState !== 1 || !this.selfId) return false
    // 앉기 전에 걸은 걸음이 앉기 요청보다 늦게 도착하면 서버가 "움직였다"며 일으켜 세운다. 남은 걸음을 먼저 보낸다.
    while (this.commandMode && this.commands.length) {
      const before = this.commands.length
      this.lastInputSent = 0
      this.sendInput()
      if (this.commands.length === before) break
    }
    this.socket.send(JSON.stringify({ type: 'seat', seatId, roomEpoch: this.roomEpoch }))
    return true
  }

  /** @return 서버가 마지막으로 알려 준 내 의자, 없으면 null */
  /** 지금 방 바닥 아이템 */
  ground() { return this.groundItems }
  /** 지금 방(회의실)에 함께 있는 다른 연구원 */
  roomPlayers() { return [...this.players.values()].filter(player => player.id !== this.selfId) }
  /** 회의실에서 내 아이템을 보여 주며 교환을 신청한다. */
  offerTrade(toPlayerId: string, itemId: string) { return this.sendTrade({ type: 'trade_offer', to: toPlayerId, itemId }) }
  /** 받은 교환 신청에 답한다(내 아이템 id, 거절이면 null). */
  answerTrade(tradeId: string, itemId: string | null) { return this.sendTrade({ type: 'trade_answer', tradeId, itemId }) }
  private sendTrade(payload: object) {
    if (!this.isOnline()) return false
    this.socket!.send(JSON.stringify({ ...payload, roomEpoch: this.roomEpoch }))
    return true
  }

  /** 장면이 매 프레임 내 위치를 알려 준다(버리기·줍기 위치). */
  setPosition(x: number, y: number) { this.position = { x, y } }
  /** 가방의 아이템을 지금 서 있는 곳에 버린다. */
  dropItem(itemId: string) { return this.sendItem('drop', itemId) }
  /** 가까운 바닥 아이템을 줍는다(서버가 48px 안인지 확인한다). */
  pickItem(itemId: string) { return this.sendItem('pick', itemId) }
  private sendItem(type: 'drop' | 'pick', itemId: string) {
    if (this.travelling || this.disposed) return false
    const room = this.roomId
    void fetch(`/api/inventory/${type}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, room, x: Math.round(this.position.x), y: Math.round(this.position.y) }) })
      .then(async response => {
        if (!response.ok) { this.notify(callbacks => callbacks.inventoryError?.(response.status === 401 ? 'login' : 'unavailable')); return }
        this.setGround(room, await response.json())
        this.notify(callbacks => callbacks.inventoryChanged?.())
      })
      .catch(() => this.notify(callbacks => callbacks.inventoryError?.('unavailable')))
    return true
  }

  /** 지금 방 바닥 아이템을 다시 읽는다. */
  private loadGround() {
    const room = this.roomId
    if (typeof fetch !== 'function') return
    void fetch(`/api/inventory/ground?room=${encodeURIComponent(room)}`, { headers: { Accept: 'application/json' } })
      .then(response => response.ok ? response.json() : null).then(items => { if (items) this.setGround(room, items) }).catch(() => { })
  }

  private setGround(room: RoomId, items: unknown) {
    if (room !== this.roomId || !Array.isArray(items) || items.length > 30 || !items.every(validGroundItem)) return
    this.groundItems = items
    this.notify(callbacks => callbacks.ground?.(this.groundItems))
  }

  /** 회의실 연결이 살아 있는지(의자·채팅은 서버가 확인한다) */
  isOnline() { return this.online && !!this.selfId && this.socket?.readyState === 1 }

  selfSeat() { return (this.selfId && this.players.get(this.selfId)?.seat) || null }

  canChat() { return !this.travelling && this.chatEnabled && !!this.selfId && this.socket?.readyState === 1 }

  currentRoom() { return this.roomId }
  isTravelling() { return this.travelling }
  /**
   * 문으로 방을 옮긴다. 회의실 밖은 서버 없이 바로 옮기고(문이 열린 다음 틱에 알린다),
   * 회의실로 갈 때만 서버에 연결해 입장을 기다린다. 회의실을 나가면 연결을 끊는다.
   */
  changeRoom(doorId: string) {
    if (this.travelling || this.disposed) return false
    const door = (ROOMS[this.roomId].doors as { id: string; target: string }[]).find(entry => entry.id === doorId)
    if (!door || !this.canEnter(door.target)) return false
    const target = door.target as RoomId
    this.setInput({x:0,y:0})
    this.travelling = true
    this.notify(c => c.room?.(this.roomId, true))
    if (target === MEETING_ROOM) {
      this.online = true; this.joining = true; this.attempts = 0
      this.updateStatus({ travelling: true, roomError: undefined, phase: 'connecting', message: '회의실에 연결하는 중…' })
      this.connect()
      this.travelTimer = setTimeout(() => this.failJoin('회의실에 연결하지 못했어요. 잠시 후 다시 들어가 보세요.'), ROOM_RESPONSE_TIMEOUT_MS)
      return true
    }
    if (this.roomId === MEETING_ROOM) this.goOffline()
    setTimeout(() => {
      if (this.disposed) return
      this.travelling = false
      this.enterLocal(target)
    }, 0)
    return true
  }

  /** 서버 없이 방에 들어간다(회의실 밖). */
  private enterLocal(target: RoomId) {
    this.roomId = target; this.roomEpoch = 0
    this.groundItems = []
    this.notify(c => c.ground?.([]))
    this.updateStatus({ roomId: target, travelling: false, roomError: undefined, phase: 'solo', online: 0, roomOnline: undefined, message: SOLO_MESSAGE })
    this.notify(c => c.room?.(target, false))
    this.loadGround()
  }

  /** 회의실 연결을 끝낸다(나가기). 재연결하지 않는다. */
  private goOffline() {
    this.online = false; this.joining = false
    clearTimeout(this.retryTimer); clearTimeout(this.travelTimer)
    const socket = this.socket
    if (socket) {
      socket.onmessage = null; socket.onclose = null; socket.onerror = null; socket.onopen = null
      try { socket.close(1000, 'Left meeting room') } catch { }
    }
    this.socket = null; this.selfId = null; this.players.clear()
    this.commands = []; this.commandMode = false; this.lastQueuedInput = null; this.chatEnabled = false
    this.messages = []; this.seenMessages.clear()
    this.notify(c => c.history?.([]))
    this.notify(c => c.snapshot?.([], null))
  }

  /** 회의실 연결을 기다리다 실패하면 문 앞에 남는다. */
  private failJoin(reason: string) {
    if (!this.joining) return
    this.goOffline()
    this.travelling = false
    this.updateStatus({ travelling: false, roomError: reason, phase: 'solo', online: 0, message: SOLO_MESSAGE })
    this.notify(c => c.room?.(this.roomId, false))
  }

  private remember(message: ChatMessage) {
    if (this.seenMessages.has(message.messageId)) return false
    this.seenMessages.add(message.messageId)
    if (this.seenMessages.size > 200) this.seenMessages.delete(this.seenMessages.values().next().value!)
    this.messages = [...this.messages, message].slice(-50)
    return true
  }

  private connect() {
    if (this.disposed || !this.online) return
    this.updateStatus({ phase: this.attempts ? 'reconnecting' : 'connecting', message: this.attempts ? '회의실 연결이 끊겼어요. 다시 연결 중…' : '회의실에 연결하는 중…' })
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
          this.scoped = message.roomId !== undefined; this.roomId = message.roomId ?? MEETING_ROOM; this.roomEpoch = message.roomEpoch ?? 0
          this.travelling = false; this.joining = false; clearTimeout(this.travelTimer)
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
          this.updateStatus({ phase: 'online', nickname: own.nickname, online: this.players.size, roomOnline: this.players.size, message: '회의실에 연결됐어요.' })
          try { sessionStorage.setItem('lab.nickname', own.nickname) } catch { }
          this.loadGround()
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
        } else if (message.type === 'ground') {
          this.groundItems = message.items
          this.notify(callbacks => callbacks.ground?.(message.items))
          return
        } else if (message.type === 'trade_offer') {
          const { type: _type, roomId: _room, roomEpoch: _epoch, totalOnline: _total, ...offer } = message
          this.notify(callbacks => callbacks.tradeOffer?.(offer))
          return
        } else if (message.type === 'trade_status') {
          const { type: _type, roomId: _room, roomEpoch: _epoch, totalOnline: _total, ...status } = message
          this.notify(callbacks => callbacks.tradeStatus?.(status))
          return
        } else if (message.type === 'inventory_changed') {
          this.notify(callbacks => callbacks.inventoryChanged?.())
          return
        } else if (message.type === 'inventory_error') {
          this.notify(callbacks => callbacks.inventoryError?.(message.reason))
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
        code: event.code, reason: event.reason, wasClean: event.wasClean, cause: closeCause(event.code, event.reason), travelling: this.travelling,
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
      if (!this.joining) { clearTimeout(this.travelTimer); this.travelling = false; this.notify(c => c.room?.(this.roomId, false)) }
      this.socket = null; this.selfId = null; this.players.clear()
      this.commands = []; this.commandMode = false; this.lastQueuedInput = null
      this.notify(callbacks => callbacks.snapshot?.([], null))
      if (event.code === 1008) {
        try { sessionStorage.removeItem('lab.nickname') } catch { }
        this.info.nickname = ''
      }
      // 같은 주소의 다른 창이 연결을 가져갔다. 다시 연결하면 서로 끊어 내므로 여기서 멈춘다.
      if (event.code === REPLACED_CLOSE_CODE) {
        if (this.joining) { this.failJoin(REPLACED_MESSAGE); return }
        this.online = false
        this.updateStatus({ phase: 'replaced', online: 0, message: REPLACED_MESSAGE }); return
      }
      // 회원 닉네임 적용은 기다리지 않고 바로 다시 접속한다.
      if (event.code === NICKNAME_CLOSE_CODE) { this.attempts = 0; this.updateStatus({ phase: 'connecting', online: 0, message: '회원 닉네임으로 다시 접속하는 중…' }); this.connect(); return }
      if (event.code === 1013 && this.joining) { this.failJoin('회의실 정원(5명)이 가득 찼어요. 잠시 후 다시 들어가 보세요.'); return }
      this.updateStatus({ phase: 'reconnecting', online: 0, message: event.code === 1013 ? '회의실 정원이 가득 찼어요. 잠시 후 다시 연결합니다.' : '회의실 연결이 끊겼어요. 다시 연결 중…' })
      this.retry()
    }
  }

  private retry() {
    if (this.disposed || !this.online) return
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
