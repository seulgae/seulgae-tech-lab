import { INITIAL_CONNECTION, lobbySocketUrl, parseServerMessage } from './model/protocol.ts'
import type { ConnectionInfo, MoveInput, PlayerState } from './model/protocol'

type Callbacks = { snapshot: (players: PlayerState[], selfId: string | null) => void; status: (info: ConnectionInfo) => void }

/**
 * 소켓 상태와 입력 전송을 관리하고 끊김 시 제한된 지수 지연으로 재접속한다.
 *
 * @author seulgae
 * @version 1.0, 임시 세션 연결과 입력·재시도 자원 정리
 * @see "None"
 */
export default class MultiplayerClient {
  private socket: WebSocket | null = null
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private inputTimer: ReturnType<typeof setInterval> | undefined
  private disposed = false
  private started = false
  private attempts = 0
  private sequence = 0
  private lastMessage = 0
  private lastTick = -1
  private selfId: string | null = null
  private input: MoveInput = { x: 0, y: 0 }
  private players = new Map<string, PlayerState>()
  private info = { ...INITIAL_CONNECTION }
  private readonly callbacks: Callbacks
  private readonly stopInput = () => this.setInput({ x: 0, y: 0 })
  private readonly onVisibility = () => { if (document.hidden) this.stopInput() }

  constructor(callbacks: Callbacks) { this.callbacks = callbacks }

  start() {
    if (this.started || this.disposed) return
    this.started = true
    window.addEventListener('blur', this.stopInput)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.connect()
    this.inputTimer = setInterval(() => {
      if (this.socket?.readyState === 1 && Date.now() - this.lastMessage > 5000) this.socket.close()
      else this.sendInput()
    }, 50)
  }

  setInput(input: MoveInput) {
    if (this.input.x === input.x && this.input.y === input.y) return
    this.input = input
    this.sendInput()
  }

  private sendInput() {
    const socket = this.socket
    if (!this.selfId || socket?.readyState !== 1) return
    if (socket.bufferedAmount > 4096) { socket.close(); return }
    socket.send(JSON.stringify({ type: 'input', x: this.input.x, y: this.input.y, seq: ++this.sequence }))
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
    socket.onopen = () => { this.lastMessage = Date.now() }
    socket.onmessage = event => {
      if (this.disposed || socket !== this.socket) return
      try {
        const message = parseServerMessage(String(event.data))
        this.lastMessage = Date.now()
        if (message.type === 'welcome') {
          this.selfId = message.selfId; this.sequence = 0; this.lastTick = -1; this.attempts = 0
          this.players = new Map(message.players.map(player => [player.id, player]))
          const own = this.players.get(this.selfId)!
          this.updateStatus({ phase: 'online', nickname: own.nickname, online: this.players.size, message: '로비에 연결됐어요.' })
          try { sessionStorage.setItem('lab.nickname', own.nickname) } catch { }
          this.sendInput()
        } else if (!this.selfId) return
        else if (message.type === 'state') {
          if (message.tick <= this.lastTick) return
          this.lastTick = message.tick
          this.players = new Map(message.players.map(player => [player.id, player]))
        } else if (message.type === 'joined') this.players.set(message.player.id, message.player)
        else if (message.type === 'left') this.players.delete(message.id)
        this.callbacks.snapshot([...this.players.values()], this.selfId)
        this.updateStatus({ online: this.players.size })
      } catch { socket.close(4002, 'Invalid server frame') }
    }
    socket.onerror = () => socket.close()
    socket.onclose = event => {
      if (this.disposed || socket !== this.socket) return
      socket.onmessage = null; socket.onclose = null; socket.onerror = null; socket.onopen = null
      this.socket = null; this.selfId = null; this.players.clear()
      this.callbacks.snapshot([], null)
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
    const delay = Math.min(8000, 500 * 2 ** Math.min(this.attempts++, 4))
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }

  private updateStatus(patch: Partial<ConnectionInfo>) {
    const next = { ...this.info, ...patch }
    if (Object.keys(next).every(key => next[key as keyof ConnectionInfo] === this.info[key as keyof ConnectionInfo])) return
    this.info = next
    this.callbacks.status(next)
  }

  /** 재시도·입력 타이머와 브라우저 이벤트를 먼저 해제한 뒤 소켓을 닫는다. */
  destroy() {
    this.disposed = true
    clearTimeout(this.retryTimer); clearInterval(this.inputTimer)
    window.removeEventListener('blur', this.stopInput)
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.socket) {
      this.socket.onmessage = null; this.socket.onclose = null; this.socket.onerror = null; this.socket.onopen = null
      this.socket.close()
    }
    this.socket = null; this.players.clear()
  }
}
