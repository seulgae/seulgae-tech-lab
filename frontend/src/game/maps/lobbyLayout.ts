export const WORLD = { width: 800, height: 600, tile: 32, wall: 24 }
export const COMPUTER = { x: 620, y: 330, width: 112, height: 72 }

export const LOBBY_OBJECTS = [
  { texture: 'reception', x: 400, bottom: 222, body: { x: 400, y: 190, width: 200, height: 64 } },
  { texture: 'computer', x: COMPUTER.x, bottom: 366, body: COMPUTER },
  { texture: 'chair', x: 620, bottom: 430, body: { x: 620, y: 418, width: 28, height: 24 } },
  { texture: 'chair', x: 340, bottom: 280, body: { x: 340, y: 268, width: 28, height: 24 } },
  { texture: 'rack', x: 112, bottom: 222, body: { x: 112, y: 178, width: 48, height: 88 } },
  { texture: 'rack', x: 688, bottom: 208, body: { x: 688, y: 164, width: 48, height: 88 } },
  { texture: 'equipment', x: 152, bottom: 386, body: { x: 152, y: 358, width: 96, height: 56 } },
  { texture: 'plant', x: 66, bottom: 126, body: { x: 66, y: 116, width: 24, height: 20 } },
  { texture: 'plant', x: 734, bottom: 494, body: { x: 734, y: 484, width: 24, height: 20 } },
] as const

/** 바닥 타일 인덱스를 반환한다. 표시와 충돌 데이터는 독립적으로 유지한다. */
export function createFloorData() {
  return Array.from({ length: 19 }, (_, row) => Array.from({ length: 25 }, (_, column) => {
    if (row >= 4 && row <= 8 && column >= 8 && column <= 15) return 2
    return (row + column) % 5 === 0 ? 1 : 0
  }))
}
