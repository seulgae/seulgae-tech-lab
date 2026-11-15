import type Phaser from 'phaser'

export type Facing = 'down' | 'up' | 'left' | 'right'
const directions: Facing[] = ['down', 'up', 'left', 'right']

export function getFacing(x: number, y: number, previous: Facing): Facing {
  if (y !== 0) return y < 0 ? 'up' : 'down'
  if (x !== 0) return x < 0 ? 'left' : 'right'
  return previous
}

/** Phaser의 시간 기반 애니메이션 시계를 사용하며 게임마다 한 번만 등록한다. */
export function createPlayerAnimations(scene: Phaser.Scene) {
  for (const [index, direction] of directions.entries()) {
    for (const mode of ['walk', 'idle'] as const) {
      const key = `${mode}-${direction}`
      if (scene.anims.exists(key)) continue
      const start = (index + (mode === 'idle' ? 4 : 0)) * 4
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers('researcher', { start, end: start + 3 }), frameRate: mode === 'walk' ? 9 : 2, repeat: -1 })
    }
  }
}
