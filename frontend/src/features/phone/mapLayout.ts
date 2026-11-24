import { ROOMS } from '../../game/maps/rooms.ts'
import type { RoomId } from '../../game/maps/rooms.ts'

/**
 * 폰 지도 앱의 배치 계산. 문이 여러 개인 방(로비·개발 연구실)을 한 구역의 가운데에 두고,
 * 문 위치(왼쪽 위·오른쪽 위·왼쪽 아래·오른쪽 아래·아래 가운데)대로 이웃 방을 둘레에 놓는다.
 * 맵 데이터(shared/lobby-world.json)에서 바로 계산하므로 방이 바뀌어도 지도가 따라간다.
 *
 * @author 길태형
 * @version 1.0, 폰 지도 앱
 * @see None
 */
export type MapSlot = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom'
export type MapCell = { room: RoomId; name: string; slot: MapSlot | 'center'; hub?: RoomId }
export type MapArea = { hub: RoomId; name: string; cells: MapCell[] }

/**
 * 문 좌표를 지도 칸으로 바꾼다.
 *
 * @param x 문 x
 * @param y 문 y
 * @returns 지도 칸
 */
export function slotOf(x: number, y: number): MapSlot {
  if (Math.abs(x - 400) < 100) return 'bottom'
  return `${y < 400 ? 'top' : 'bottom'}-${x < 400 ? 'left' : 'right'}` as MapSlot
}

/**
 * 구역(가운데 방 + 둘레 방) 목록. 다른 구역으로 가는 문은 그 구역 이름으로 표시한다(hub).
 *
 * @returns 로비 구역, 개발 연구실 구역 순
 */
export function mapAreas(): MapArea[] {
  const ids = Object.keys(ROOMS) as RoomId[]
  const hubs = ids.filter(id => ROOMS[id].doors.length > 1)
  return hubs.map(hub => ({
    hub, name: ROOMS[hub].name,
    cells: [
      { room: hub, name: ROOMS[hub].name, slot: 'center' as const },
      ...ROOMS[hub].doors.map(door => {
        const room = door.target as RoomId
        return { room, name: ROOMS[room].name, slot: slotOf(door.x, door.y), ...(hubs.includes(room) ? { hub: room } : {}) }
      }),
    ],
  }))
}

/**
 * 지금 방이 속한 구역(가운데 방이거나 그 둘레 방).
 *
 * @param room 지금 방
 * @returns 구역의 가운데 방
 */
export function areaOf(room: RoomId): RoomId {
  const areas = mapAreas()
  return areas.find(area => area.hub === room)?.hub
    ?? areas.find(area => area.cells.some(cell => cell.room === room && !cell.hub))?.hub
    ?? areas[0]!.hub
}
