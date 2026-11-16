import layout from '../../../../shared/lobby-world.json' with { type: 'json' }
import { isNearObject } from '../interaction.ts'
export type RoomId = keyof typeof layout.rooms
/** 공유 맵에 정의한 상호작용과, 가구에서 만든 의자(seat)·식물(plant) 상호작용 */
export type InteractionKind = 'research' | 'build-info' | 'server-status' | 'table-talk' | 'agenda' | 'seat' | 'plant'
export type RoomInteraction = { id: string; kind: InteractionKind; label: string; x: number; y: number; width: number; height: number; range: number }
/** 의자: 서버 LobbyWorld.Seat와 같은 id(방-chair-순번)와 충돌 영역, 그림 기준선(bottom) */
export type Seat = RoomInteraction & { kind: 'seat'; bottom: number }
export const ROOMS = layout.rooms
export const SEAT_RANGE = 40
const PLANT_RANGE = 40
export const isRoomId = (id: unknown): id is RoomId => typeof id === 'string' && Object.hasOwn(ROOMS, id)
export function roomObjects(id: RoomId) { return id === 'lobby' ? layout.objects : layout.rooms[id].objects }
export function roomObstacles(id: RoomId) { return [...layout.walls, ...roomObjects(id).map(object => object.body)] }
export function roomInteractions(id: RoomId) { return (ROOMS[id].interactions ?? []) as RoomInteraction[] }

/** 방의 의자. 서버와 같은 순서(가구 목록에서 chair만)로 id를 붙인다. */
export function roomSeats(id: RoomId): Seat[] {
  return roomObjects(id).filter(object => object.texture === 'chair').map((object, index) => ({
    id: `${id}-chair-${index}`, kind: 'seat', label: '앉기', ...object.body, range: SEAT_RANGE, bottom: object.bottom,
  }))
}

/** 방의 화분. 클라이언트 전용 연출이라 서버 검증이 없다. */
export function roomPlants(id: RoomId): (RoomInteraction & { bottom: number })[] {
  return roomObjects(id).filter(object => object.texture === 'plant').map((object, index) => ({
    id: `${id}-plant-${index}`, kind: 'plant', label: '식물 건드리기', ...object.body, range: PLANT_RANGE, bottom: object.bottom,
  }))
}

const edgeDistance = (x: number, y: number, area: RoomInteraction) =>
  Math.hypot(Math.max(Math.abs(x - area.x) - area.width / 2, 0), Math.max(Math.abs(y - area.y) - area.height / 2, 0))

/**
 * 범위 안 상호작용 중 가장자리 거리가 가장 가까운 하나를 고른다(같으면 공유 맵 상호작용 우선).
 * 의자는 책상·테이블을 바라보므로 의자 뒤(아래쪽)에서 다가갈 때만 앉기 대상이 된다.
 */
export function nearestInteraction(id: RoomId, x: number, y: number) {
  const seats = roomSeats(id).filter(seat => y >= seat.y + seat.height / 2)
  const candidates: RoomInteraction[] = [...roomInteractions(id), ...seats, ...roomPlants(id)]
  let best: RoomInteraction | undefined
  let bestDistance = Infinity
  for (const interaction of candidates) {
    if (!isNearObject(x, y, interaction, interaction.range)) continue
    const distance = edgeDistance(x, y, interaction)
    if (distance < bestDistance) { best = interaction; bestDistance = distance }
  }
  return best
}

export function seatById(id: string | null | undefined) {
  if (!id) return undefined
  for (const roomId of Object.keys(ROOMS) as RoomId[]) {
    const seat = roomSeats(roomId).find(candidate => candidate.id === id)
    if (seat) return seat
  }
  return undefined
}
