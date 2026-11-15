import type Phaser from 'phaser'
import { WORLD, WALLS, LOBBY_OBJECTS, PLAYER_FOOT } from '../maps/lobbyLayout.ts'

const obstacles = [...WALLS, ...LOBBY_OBJECTS.map(object => object.body)]

/** 서버와 같은 발밑 모양을 기준으로 보정 경로가 벽과 가구를 통과하지 않도록 축별로 제한한다. */
export function constrainedPosition(x: number, y: number, dx: number, dy: number) {
  const half = PLAYER_FOOT.halfWidth, height = PLAYER_FOOT.height
  let nx = Math.max(half, Math.min(WORLD.width - half, x + dx))
  for (const area of obstacles) {
    if (y <= area.y - area.height / 2 || y - height >= area.y + area.height / 2) continue
    const left = area.x - area.width / 2, right = area.x + area.width / 2
    if (dx > 0 && x + half <= left && nx + half > left) nx = Math.min(nx, left - half)
    if (dx < 0 && x - half >= right && nx - half < right) nx = Math.max(nx, right + half)
  }
  let ny = Math.max(height, Math.min(WORLD.height, y + dy))
  for (const area of obstacles) {
    if (nx + half <= area.x - area.width / 2 || nx - half >= area.x + area.width / 2) continue
    const top = area.y - area.height / 2, bottom = area.y + area.height / 2
    if (dy > 0 && y <= top && ny > top) ny = Math.min(ny, top)
    if (dy < 0 && y - height >= bottom && ny - height < bottom) ny = Math.max(ny, bottom + height)
  }
  return { x: nx, y: ny }
}

/** 물리 postUpdate 후 Sprite와 Body를 같은 양만큼 옮겨 속도·충돌 플래그·발밑 offset을 보존한다. */
export function translateBody(sprite: Phaser.GameObjects.Sprite, body: Phaser.Physics.Arcade.Body, dx: number, dy: number) {
  sprite.setPosition(sprite.x + dx, sprite.y + dy)
  for (const position of [body.position, body.prev, body.prevFrame]) { position.x += dx; position.y += dy }
  body.updateCenter()
}
