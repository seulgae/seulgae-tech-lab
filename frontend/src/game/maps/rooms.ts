import layout from '../../../../shared/lobby-world.json' with { type: 'json' }
import { isNearObject } from '../interaction.ts'
export type RoomId = keyof typeof layout.rooms
export type InteractionKind = 'research' | 'build-info' | 'server-status' | 'table-talk'
export type RoomInteraction = { id: string; kind: InteractionKind; label: string; x: number; y: number; width: number; height: number; range: number }
export const ROOMS = layout.rooms
export const isRoomId = (id: unknown): id is RoomId => typeof id === 'string' && Object.hasOwn(ROOMS, id)
export function roomObjects(id: RoomId) { return id === 'lobby' ? layout.objects : layout.rooms[id].objects }
export function roomObstacles(id: RoomId) { return [...layout.walls, ...roomObjects(id).map(object => object.body)] }
export function roomInteractions(id: RoomId) { return (ROOMS[id].interactions ?? []) as RoomInteraction[] }

/** 서버 `LobbyWorld.near`와 같은 가장자리 거리로 가장 가까운 상호작용 하나를 고른다. */
export function nearestInteraction(id: RoomId, x: number, y: number) {
  let best: RoomInteraction | undefined
  let bestDistance = Infinity
  for (const interaction of roomInteractions(id)) {
    if (!isNearObject(x, y, interaction, interaction.range)) continue
    const distance = Math.hypot(x - interaction.x, y - interaction.y)
    if (distance < bestDistance) { best = interaction; bestDistance = distance }
  }
  return best
}
