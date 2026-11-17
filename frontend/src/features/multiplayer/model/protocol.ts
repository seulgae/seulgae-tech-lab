import { isRoomId } from '../../../game/maps/rooms.ts'
import type { RoomId } from '../../../game/maps/rooms'
export type Facing = 'down' | 'up' | 'left' | 'right'
export type MoveInput = { x: number; y: number }
export type MoveCommand = MoveInput & { seq: number; ms: number }
/** seat: 서버가 확인한 앉은 의자 id(예: meeting-room-chair-1), 서 있으면 null. 구형 서버는 보내지 않는다. */
/** 관제실(cctv 상호작용이 있는 방)에 있을 때만 서버가 보내는 방별 참가자 목록 */
export type RoomFeeds = Partial<Record<RoomId, PlayerState[]>>
/** 방 바닥에 놓인 아이템(누구나 주울 수 있다) */
export type GroundItem = { id: string; kind: string; name: string; sizeCm: number | null; x: number; y: number }
export type PlayerState = { id: string; nickname: string; x: number; y: number; facing: Facing; moving: boolean; ack: number; seat?: string | null }
export type ConnectionInfo = { roomId?: RoomId; roomOnline?: number; totalOnline?: number; travelling?: boolean; roomError?: string; phase: 'connecting' | 'online' | 'reconnecting' | 'replaced'; nickname: string; online: number; maxPlayers: number; message: string }
export type ChatMessage = { type: 'chat_message'; messageId: string; playerId: string; nickname: string; message: string; sentAt: string; scope?: ChatScope }
/** room은 같은 방 전체, table은 서버가 확인한 회의 테이블 주변 참가자에게만 전달한다. */
export type ChatScope = 'room' | 'table'
export type ChatError = 'empty' | 'too_long' | 'rate_limited' | 'unavailable' | 'invalid' | 'not_at_table'
type RoomMeta = { roomId?: RoomId; roomEpoch?: number; totalOnline?: number }
export type ServerMessage = RoomMeta & (
  | ChatMessage
  | { type: 'chat_history'; messages: ChatMessage[] }
  | { type: 'chat_error'; reason: ChatError }
  | { type: 'welcome'; selfId: string; players: PlayerState[]; maxPlayers: number; protocolVersion?: number; time?: number }
  | { type: 'state'; tick: number; players: PlayerState[]; time?: number; feeds?: RoomFeeds }
  | { type: 'joined'; player: PlayerState }
  | { type: 'left'; id: string }
  | { type: 'room_changed'; selfId: string; players: PlayerState[]; time?: number }
  | { type: 'room_error'; reason: string }
  | { type: 'ground'; items: GroundItem[] }
  | { type: 'inventory_changed' }
  | { type: 'inventory_error'; reason: 'login' | 'unavailable' }
)

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
    && (message.scope === undefined || message.scope === 'room' || message.scope === 'table')
    && /^\d{4}-\d\d-\d\dT/.test(message.sentAt) && message.sentAt.endsWith('Z') && Number.isFinite(Date.parse(message.sentAt))
}

function validPlayer(value: unknown): value is PlayerState {
  if (!value || typeof value !== 'object') return false
  const p = value as PlayerState
  return validId(p.id) && validNickname(p.nickname) && Number.isFinite(p.x) && p.x >= 0 && p.x <= 800
    && Number.isFinite(p.y) && p.y >= 0 && p.y <= 600 && ['up', 'down', 'left', 'right'].includes(p.facing)
    && typeof p.moving === 'boolean' && Number.isSafeInteger(p.ack) && p.ack >= -1
    && (p.seat === undefined || p.seat === null || typeof p.seat === 'string' && /^[a-z-]{1,32}-chair-[0-9]{1,2}$/.test(p.seat))
}

/** 서버 프레임도 크기·좌표·열거값을 확인한 뒤 장면과 UI에 전달한다. */
export function parseServerMessage(raw: string): ServerMessage {
  if (raw.length > 65536) throw new Error('Frame too large')
  const message = JSON.parse(raw)
  if (!message || typeof message !== 'object') throw new Error('Invalid frame')
  if (message.roomId !== undefined && (!isRoomId(message.roomId) || !Number.isSafeInteger(message.roomEpoch) || message.roomEpoch < 0)) throw new Error('Invalid room')
  if ((message.type === 'state' || message.type === 'welcome' || message.type === 'room_changed') && message.time !== undefined
    && (!Number.isFinite(message.time) || message.time < 0)) throw new Error('Invalid server time')
  if (message.type === 'joined' && validPlayer(message.player)) return message
  if (message.type === 'left' && validId(message.id)) return message
  if (message.type === 'chat_message' && validChat(message)) return message
  if (message.type === 'chat_history' && Array.isArray(message.messages) && message.messages.length <= 50
    && message.messages.every(validChat) && new Set(message.messages.map((item: ChatMessage) => item.messageId)).size === message.messages.length) return message
  if (message.type === 'chat_error' && ['empty', 'too_long', 'rate_limited', 'unavailable', 'invalid', 'not_at_table'].includes(message.reason)) return message
  if (message.type === 'room_error' && typeof message.reason === 'string' && message.reason.length <= 100) return message
  if (message.type === 'ground' && Array.isArray(message.items) && message.items.length <= 30 && message.items.every(validGroundItem)) return message
  if (message.type === 'inventory_changed') return message
  if (message.type === 'inventory_error' && (message.reason === 'login' || message.reason === 'unavailable')) return message
  const players = message.players
  if (!Array.isArray(players) || players.length > 5 || !players.every(validPlayer) || new Set(players.map(p => p.id)).size !== players.length) throw new Error('Invalid players')
  if (message.type === 'room_changed' && isRoomId(message.roomId) && Number.isSafeInteger(message.roomEpoch) && validId(message.selfId) && players.some(p => p.id === message.selfId)) return message
  if (message.type === 'welcome' && validId(message.selfId) && players.some(p => p.id === message.selfId) && message.maxPlayers === 5) return message
  if (message.type === 'state' && Number.isSafeInteger(message.tick) && message.tick >= 0) {
    if (message.feeds !== undefined && !validFeeds(message.feeds)) throw new Error('Invalid feeds')
    return message
  }
  throw new Error('Invalid frame')
}

/**
 * 콘솔(F12)에서 끊김 원인을 바로 알 수 있도록 종료 코드를 사람이 읽는 설명으로 바꾼다.
 * 4001~4005는 클라이언트가 스스로 닫은 경우, 그 밖은 서버·브라우저가 닫은 경우다.
 */
/** 같은 주소(IP)에서 새 창이 접속해 이 연결을 대신했다는 서버 종료 코드. 이 코드에서는 다시 연결하지 않는다. */
/** 로그인 확인이 늦게 끝나 회원 닉네임으로 다시 접속할 때 클라이언트가 닫는 코드 */
export const NICKNAME_CLOSE_CODE = 4006
export const REPLACED_CLOSE_CODE = 4409
export const REPLACED_MESSAGE = '다른 창에서 접속해 이 창의 연결을 끊었어요. 새로고침하면 이 창으로 다시 접속해요.'

/** 방 id는 공유 맵에 있는 것만, 전체 인원은 정원(5) 이하, 한 사람은 한 방에만 있어야 한다. */
function validGroundItem(value: unknown): value is GroundItem {
  const item = value as GroundItem
  return Boolean(item) && validId(item.id) && typeof item.kind === 'string' && item.kind.length <= 20 && typeof item.name === 'string'
    && item.name.length >= 1 && item.name.length <= 30 && (item.sizeCm === null || Number.isSafeInteger(item.sizeCm))
    && Number.isFinite(item.x) && Number.isFinite(item.y) && item.x >= 0 && item.x <= 800 && item.y >= 0 && item.y <= 600
}

function validFeeds(feeds: unknown): feeds is RoomFeeds {
  if (!feeds || typeof feeds !== 'object' || Array.isArray(feeds)) return false
  const entries = Object.entries(feeds)
  const players = entries.flatMap(([, list]) => Array.isArray(list) ? list : [null])
  return entries.every(([roomId, list]) => isRoomId(roomId) && Array.isArray(list)) && players.length <= 5
    && players.every(validPlayer) && new Set(players.map(player => (player as PlayerState).id)).size === players.length
}

export function closeCause(code: number, reason = '') {
  const causes: Record<number, string> = {
    1000: '정상 종료', 1001: '페이지 이동 또는 서버 종료', 1006: '네트워크 단절(종료 프레임 없음)',
    1008: `서버가 입력을 거부함${reason ? `: ${reason}` : ''}`, 1009: '메시지가 너무 큼', 1011: '서버 오류', 1013: '로비 정원 초과',
    4001: '클라이언트: 10초간 서버 메시지 없음', 4002: '클라이언트: 잘못된 서버 메시지', 4003: '클라이언트: 업로드 지연으로 입력이 쌓임',
    4004: '클라이언트: 이동 확인(ack) 지연', 4005: '클라이언트: 방 이동 응답 지연', 4006: '클라이언트: 회원 닉네임으로 다시 접속', 4500: '서버: 전송 지연·대기열 초과로 연결 정리',
    4409: '서버: 같은 주소의 새 연결로 대체됨',
  }
  return causes[code] ?? `알 수 없는 종료 코드 ${code}${reason ? `: ${reason}` : ''}`
}

export function lobbySocketUrl(location: Pick<Location, 'protocol' | 'host'>, nickname = '') {
  const url = new URL(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/lobby`)
  if (validNickname(nickname)) url.searchParams.set('nickname', nickname)
  return url.toString()
}
