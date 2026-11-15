import lobby from '../../../../shared/lobby-world.json' with { type: 'json' }

export const WORLD = lobby.world
export const COMPUTER = lobby.objects.find(object => object.texture === 'computer')!.body
export const LOBBY_OBJECTS = lobby.objects
export const WALLS = lobby.walls
export const PLAYER_FOOT = lobby.player
export const SPAWN = lobby.spawns[0]!

/** 바닥 타일 인덱스를 반환한다. 표시와 충돌 데이터는 독립적으로 유지한다. */
export function createFloorData() {
  return Array.from({ length: 19 }, (_, row) => Array.from({ length: 25 }, (_, column) => {
    if (row >= 4 && row <= 8 && column >= 8 && column <= 15) return 2
    return (row + column) % 5 === 0 ? 1 : 0
  }))
}
