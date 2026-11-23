export type LabPanelKind = 'server-status' | 'build-info'
/** 방 상호작용이 여는 패널: 상태·빌드 정보 패널, 회의 안건 패널, 로비 책장 책 읽기 */
export type RoomPanelKind = LabPanelKind | 'agenda' | 'bookshelf' | 'admin-console' | 'admin-apply' | 'work-board' | 'arcade' | 'inventory' | 'guestbook' | 'food-cart' | 'recruitment' | 'vending-machine' | 'server-blog'
export type RoomCount = { id: string; name: string; players: number }
export type LabStatus = {
  status: string; uptimeSeconds: number; onlinePlayers: number; maxPlayers: number
  rooms: RoomCount[]; memory: { usedMb: number; maxMb: number }; serverTime: string
}
export type BuildInfo = { version: string; commit: string; builtAt: string | null; javaVersion: string }

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const text = (value: unknown, max = 100): value is string => typeof value === 'string' && value.length <= max

/** 서버 응답도 형식을 확인한 뒤에만 화면에 표시한다. */
export function parseLabStatus(value: unknown): LabStatus {
  const s = value as LabStatus
  if (!s || typeof s !== 'object' || !text(s.status, 16) || !count(s.uptimeSeconds) || !count(s.onlinePlayers) || !count(s.maxPlayers)
    || !Array.isArray(s.rooms) || s.rooms.length > 20 || !s.rooms.every(r => r && text(r.id, 40) && text(r.name, 40) && count(r.players))
    || !s.memory || !count(s.memory.usedMb) || !count(s.memory.maxMb) || !text(s.serverTime, 40)) throw new Error('Invalid lab status')
  return s
}

export function parseBuildInfo(value: unknown): BuildInfo {
  const b = value as BuildInfo
  if (!b || typeof b !== 'object' || !text(b.version, 40) || !/^([0-9a-f]{7}|local)$/.test(b.commit)
    || !(b.builtAt === null || text(b.builtAt, 40)) || !text(b.javaVersion, 8)) throw new Error('Invalid build info')
  return b
}

/** 초 단위 가동 시간을 "1일 2시간 3분" 형태로 줄여 표시한다. */
export function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60)
  if (days > 0) return `${days}일 ${hours}시간`
  if (hours > 0) return `${hours}시간 ${minutes}분`
  return `${minutes}분 ${seconds % 60}초`
}
