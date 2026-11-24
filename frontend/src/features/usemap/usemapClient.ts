/**
 * 협동 연구실 유즈맵 대기실 연결(/ws/usemap). 방·채팅·게임 중계 메시지를 주고받는다.
 * 판정은 서버가 아니라 방장 브라우저의 맵이 한다.
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 * @see None
 */
export type UseMapPlayer = { id: string; nickname: string }
export type UseMapInfo = { id: string; name: string; minPlayers: number; maxPlayers: number }
export type UseMapRoom = { id: string; name: string; mapId: string; maxPlayers: number; locked: boolean; hostId: string; players: UseMapPlayer[]; ready: string[]; playing: boolean }
export type UseMapChat = { scope: 'lobby' | 'room'; from: string; text: string; at: number }
export type UseMapStart = { roomId: string; mapId: string; hostId: string; players: UseMapPlayer[]; seed: number }

export type ServerMessage =
  | { t: 'welcome'; you: UseMapPlayer; maps: UseMapInfo[] }
  | { t: 'rooms'; rooms: UseMapRoom[] }
  | { t: 'room'; room: UseMapRoom }
  | { t: 'left' }
  | ({ t: 'chat' } & UseMapChat)
  | ({ t: 'start' } & UseMapStart)
  | { t: 'game'; from: string; data: unknown }
  | { t: 'end'; result: Record<string, unknown> }
  | { t: 'error'; message: string }

export type ClientMessage =
  | { t: 'ping' }
  | { t: 'chat'; scope: 'lobby' | 'room'; text: string }
  | { t: 'create'; name: string; mapId: string; max: number; password: string }
  | { t: 'join'; roomId: string; password: string }
  | { t: 'leave' }
  | { t: 'ready'; ready: boolean }
  | { t: 'map'; mapId: string }
  | { t: 'start' }
  | { t: 'game'; data: unknown }
  | { t: 'end'; result: Record<string, unknown> }

/** 맵 목록 파일(화면용: 설명·실행 파일 포함) */
export type UseMapCatalogEntry = UseMapInfo & { description: string; entry: string; version: string }

/** 연결이 쉬지 않도록 보내는 간격(서버 유휴 제한 20초보다 짧게) */
export const PING_MS = 10_000
export const CHAT_MAX = 100
export const ROOM_NAME_MAX = 20

/**
 * 유즈맵 대기실 연결을 연다.
 *
 * @param onMessage 서버 메시지
 * @param onState 연결 상태('open' | 'closed')
 * @returns 보내기·닫기
 */
export function connectUseMap(onMessage: (message: ServerMessage) => void, onState: (state: 'open' | 'closed') => void) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/usemap`
  const socket = new WebSocket(url)
  let ping = 0
  socket.onopen = () => { onState('open'); ping = window.setInterval(() => send({ t: 'ping' }), PING_MS) }
  socket.onclose = () => { window.clearInterval(ping); onState('closed') }
  socket.onmessage = event => {
    try { onMessage(JSON.parse(String(event.data)) as ServerMessage) } catch { /* 모르는 메시지는 무시 */ }
  }
  const send = (message: ClientMessage) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)) }
  return { send, close: () => { window.clearInterval(ping); socket.close() } }
}

/**
 * 맵 iframe과 주고받는 메시지(맵 SDK와 같은 모양). source로 다른 창의 메시지와 구분한다.
 */
export const SDK_SOURCE = 'seulgae-usemap'
export type ToMap =
  | { source: typeof SDK_SOURCE; type: 'init'; me: UseMapPlayer; hostId: string; players: UseMapPlayer[]; seed: number }
  | { source: typeof SDK_SOURCE; type: 'message'; from: string; data: unknown }
export type FromMap =
  | { source: typeof SDK_SOURCE; type: 'ready' }
  | { source: typeof SDK_SOURCE; type: 'send'; data: unknown }
  | { source: typeof SDK_SOURCE; type: 'end'; result: Record<string, unknown> }

/**
 * 맵이 보낸 메시지인지 확인한다(모양이 다르면 null).
 *
 * @param value postMessage로 받은 값
 * @returns 맵 메시지
 */
export function parseFromMap(value: unknown): FromMap | null {
  if (!value || typeof value !== 'object') return null
  const message = value as { source?: unknown; type?: unknown; result?: unknown }
  if (message.source !== SDK_SOURCE) return null
  if (message.type === 'ready' || message.type === 'send') return message as FromMap
  if (message.type === 'end' && message.result && typeof message.result === 'object') return message as FromMap
  return null
}

/**
 * 방 상태로 내가 할 수 있는 일을 정한다.
 *
 * @param room 방
 * @param me 내 연결 id
 * @param map 방의 맵
 * @returns 방장인지, 준비했는지, 시작할 수 있는지와 이유
 */
export function roomActions(room: UseMapRoom, me: string, map: UseMapInfo | undefined) {
  const host = room.hostId === me
  const others = room.players.filter(player => player.id !== room.hostId)
  const allReady = others.every(player => room.ready.includes(player.id))
  const enough = room.players.length >= (map?.minPlayers ?? 1)
  return {
    host, ready: room.ready.includes(me),
    canStart: host && !room.playing && allReady && enough,
    waitingFor: !enough ? `${map?.minPlayers ?? 1}명부터 시작할 수 있어요` : !allReady ? '모두 준비하면 시작할 수 있어요' : '',
  }
}
