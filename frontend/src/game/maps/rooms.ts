import layout from '../../../../shared/lobby-world.json' with { type: 'json' }
export type RoomId = keyof typeof layout.rooms
export const ROOMS = layout.rooms
export const isRoomId = (id: unknown): id is RoomId => typeof id === 'string' && Object.hasOwn(ROOMS, id)
export function roomObjects(id: RoomId) { return id === 'lobby' ? layout.objects : layout.rooms[id].objects }
export function roomObstacles(id: RoomId) { return [...layout.walls, ...roomObjects(id).map(object => object.body)] }
