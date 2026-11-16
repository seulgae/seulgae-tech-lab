export type Facing = 'down' | 'up' | 'left' | 'right'
export type MoveInput = { x: number; y: number }
export type MoveCommand = MoveInput & { seq: number; ms: number }
export type PlayerState = { id: string; nickname: string; x: number; y: number; facing: Facing; moving: boolean; ack: number }
export type ConnectionInfo = { phase: 'connecting' | 'online' | 'reconnecting'; nickname: string; online: number; maxPlayers: number; message: string }
export type ChatMessage = { type: 'chat_message'; messageId: string; playerId: string; nickname: string; message: string; sentAt: string }
export type ChatError = 'empty' | 'too_long' | 'rate_limited' | 'unavailable' | 'invalid'
export type ServerMessage =
  | ChatMessage
  | { type: 'chat_history'; messages: ChatMessage[] }
  | { type: 'chat_error'; reason: ChatError }
  | { type: 'welcome'; selfId: string; players: PlayerState[]; maxPlayers: number; protocolVersion?: number; time?: number }
  | { type: 'state'; tick: number; players: PlayerState[]; time?: number }
  | { type: 'joined'; player: PlayerState }
  | { type: 'left'; id: string }

export const MULTIPLAYER_EVENTS = { dispose: 'multiplayer:dispose' } as const
export const INITIAL_CONNECTION: ConnectionInfo = { phase: 'connecting', nickname: '', online: 0, maxPlayers: 5, message: '로비 연결 중…' }
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
export const validNickname = (value: unknown): value is string => typeof value === 'string' && /^[\p{L}\p{N}_-]{1,16}$/u.test(value)
export const normalizeChat = (value: string) => value.replace(/\r\n?/g, '\n').trim()
export const validChatText = (value: unknown): value is string => typeof value === 'string' && normalizeChat(value).length > 0
  && Array.from(value).length <= 150 && Array.from(value).every(character => {
    const code = character.codePointAt(0)!
    return code === 9 || code === 10 || code >= 32 && !(code >= 127 && code <= 159) && !(code >= 0xd800 && code <= 0xdfff)
  })

function validChat(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as ChatMessage
  return message.type === 'chat_message' && validId(message.messageId) && validId(message.playerId)
    && validNickname(message.nickname) && validChatText(message.message) && typeof message.sentAt === 'string'
    && /^\d{4}-\d\d-\d\dT/.test(message.sentAt) && message.sentAt.endsWith('Z') && Number.isFinite(Date.parse(message.sentAt))
}

function validPlayer(value: unknown): value is PlayerState {
  if (!value || typeof value !== 'object') return false
  const p = value as PlayerState
  return validId(p.id) && validNickname(p.nickname) && Number.isFinite(p.x) && p.x >= 0 && p.x <= 800
    && Number.isFinite(p.y) && p.y >= 0 && p.y <= 600 && ['up', 'down', 'left', 'right'].includes(p.facing)
    && typeof p.moving === 'boolean' && Number.isSafeInteger(p.ack) && p.ack >= -1
}

/** 서버 프레임도 크기·좌표·열거값을 확인한 뒤 장면과 UI에 전달한다. */
export function parseServerMessage(raw: string): ServerMessage {
  if (raw.length > 65536) throw new Error('Frame too large')
  const message = JSON.parse(raw)
  if (!message || typeof message !== 'object') throw new Error('Invalid frame')
  if ((message.type === 'state' || message.type === 'welcome') && message.time !== undefined
    && (!Number.isFinite(message.time) || message.time < 0)) throw new Error('Invalid server time')
  if (message.type === 'joined' && validPlayer(message.player)) return message
  if (message.type === 'left' && validId(message.id)) return message
  if (message.type === 'chat_message' && validChat(message)) return message
  if (message.type === 'chat_history' && Array.isArray(message.messages) && message.messages.length <= 50
    && message.messages.every(validChat) && new Set(message.messages.map((item: ChatMessage) => item.messageId)).size === message.messages.length) return message
  if (message.type === 'chat_error' && ['empty', 'too_long', 'rate_limited', 'unavailable', 'invalid'].includes(message.reason)) return message
  const players = message.players
  if (!Array.isArray(players) || players.length > 5 || !players.every(validPlayer) || new Set(players.map(p => p.id)).size !== players.length) throw new Error('Invalid players')
  if (message.type === 'welcome' && validId(message.selfId) && players.some(p => p.id === message.selfId) && message.maxPlayers === 5) return message
  if (message.type === 'state' && Number.isSafeInteger(message.tick) && message.tick >= 0) return message
  throw new Error('Invalid frame')
}

export function lobbySocketUrl(location: Pick<Location, 'protocol' | 'host'>, nickname = '') {
  const url = new URL(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/lobby`)
  if (validNickname(nickname)) url.searchParams.set('nickname', nickname)
  return url.toString()
}
