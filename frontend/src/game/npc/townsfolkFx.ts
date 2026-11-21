import Phaser from 'phaser'
import type { Context } from '../rooms/fxContext'
import type { RoomInteraction } from '../maps/rooms'
import { playSfx } from '../../audio/AudioManager'
import Npc from './Npc.ts'
import { CART_SPOT, cartOpenAt } from './npcData.ts'
import type { NpcDef } from './npcData.ts'

/** 방 연출이 장면에 건네는 움직이는 상호작용 대상(NPC·포장마차) */
export type Townsfolk = {
  targets(): RoomInteraction[]
  /** NPC면 말을 걸고 true. 포장마차는 장면이 창을 열도록 false */
  intercept(target: RoomInteraction): boolean
  hint(target: RoomInteraction): string | undefined
  destroy(): void
}

/**
 * NPC들을 만들고 매 프레임 움직인다. E로 말을 걸면 멈춰서 한마디 한다.
 * @param withCart 바깥이면 저녁 6시에 맵 밖에서 들어오는 포장마차도 둔다.
 */
export function townsfolk(ctx: Context, defs: readonly NpcDef[], withCart = false): Townsfolk {
  const { scene } = ctx
  const npcs = defs.map(def => new Npc(scene, def))
  const cart = withCart ? foodCart(ctx) : undefined
  const tick = (_time: number, delta: number) => { for (const npc of npcs) npc.update(delta); cart?.update() }
  scene.events.on('update', tick)
  return {
    targets: () => [...npcs.map(npc => npc.target()), ...(cart?.target() ?? [])],
    intercept: target => {
      const npc = npcs.find(entry => entry.def.id === target.id)
      if (!npc) return false
      npc.talk(ctx.options.player?.())
      playSfx('chat', { volume: 0.5 })
      return true
    },
    hint: target => target.kind === 'npc' ? 'E · 말 걸기' : target.kind === 'food-cart' ? 'E · 포장마차 (물고기 팔기)' : undefined,
    destroy: () => { scene.events.off('update', tick); for (const npc of npcs) npc.destroy(); cart?.destroy() },
  }
}

/**
 * 포장마차: 저녁 6시~자정에만 연다. 그 시각에 바깥에 있으면 맵 왼쪽 밖에서 덜컹덜컹 굴러 들어오고, 자정이 되면 오른쪽으로 떠난다.
 * 저녁에 바깥으로 나오면 이미 자리를 잡고 있다.
 */
function foodCart(ctx: Context) {
  const { scene } = ctx
  const startX = -120, endX = 920
  const image = scene.add.image(startX, CART_SPOT.bottom, 'food-cart').setOrigin(0.5, 1).setScale(2).setDepth(CART_SPOT.bottom).setVisible(false)
  // 저녁을 밝히는 조명: 지붕 위에 매단 백열등(전선·전구)과 넓게 퍼지는 따뜻한 빛, 수레 아래 바닥 빛
  const bulbY = CART_SPOT.bottom - 92
  const wire = scene.add.rectangle(startX, bulbY - 8, 2, 12, 0x2b2220).setDepth(CART_SPOT.bottom + 2).setVisible(false)
  const bulb = scene.add.circle(startX, bulbY, 5, 0xfff4c2).setDepth(CART_SPOT.bottom + 3).setVisible(false)
  const halo = scene.add.circle(startX, bulbY, 110, 0xffe08a, 0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(CART_SPOT.bottom + 1).setVisible(false)
  const light = scene.add.circle(startX, CART_SPOT.bottom - 16, 90, 0xffb46b, 0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(CART_SPOT.bottom - 1).setVisible(false)
  const sign = ctx.text(startX, bulbY - 22, '포장마차', 11, '#ffd23f', CART_SPOT.bottom + 4, true).setVisible(false)
  const lamp = [wire, bulb, halo, light, sign]
  let state: 'closed' | 'arriving' | 'open' | 'leaving' = 'closed'
  const place = (x: number) => { image.setX(x); for (const part of lamp) part.setX(x) }
  const show = (visible: boolean) => { image.setVisible(visible); for (const part of lamp) part.setVisible(visible) }
  const roll = (from: number, to: number, done: () => void) => {
    show(true); place(from)
    scene.tweens.addCounter({ from, to, duration: 7000, ease: 'Sine.easeOut', onUpdate: tween => {
      const x = tween.getValue() ?? to
      place(x)
      // 덜컹덜컹
      image.setY(CART_SPOT.bottom - (Math.floor(x / 12) % 2))
    }, onComplete: done })
  }
  const check = (first: boolean) => {
    const open = cartOpenAt(new Date())
    if (open && state === 'closed') {
      if (first) { state = 'open'; show(true); place(CART_SPOT.x); return }
      state = 'arriving'
      ctx.banner.show('저녁 6시! 포장마차가 들어와요 · 잡은 물고기를 팔 수 있어요', '#ffb46b', 3600)
      playSfx('notify', { volume: 0.5 })
      roll(startX, CART_SPOT.x, () => { state = 'open' })
    } else if (!open && state === 'open') {
      state = 'leaving'
      ctx.banner.show('포장마차가 오늘 장사를 마쳤어요', '#ffb46b', 2600)
      roll(CART_SPOT.x, endX, () => { state = 'closed'; show(false) })
    }
  }
  check(true)
  const timer = scene.time.addEvent({ delay: 5000, loop: true, callback: () => check(false) })
  let glowAge = 0
  return {
    // 백열등이 아주 살짝 일렁인다.
    update() {
      if (!halo.visible) return
      const flicker = Math.abs(Math.sin(glowAge++ / 37)) * 0.05 + (Math.random() < 0.02 ? -0.06 : 0)
      halo.setAlpha(0.27 + flicker); light.setAlpha(0.18 + flicker)
    },
    target(): RoomInteraction[] {
      return state === 'open' ? [{ id: 'food-cart', kind: 'food-cart', label: '포장마차', x: CART_SPOT.x, y: CART_SPOT.bottom - 34, width: 96, height: 60, range: 28 }] : []
    },
    destroy() { timer.remove(); image.destroy(); for (const part of lamp) part.destroy() },
  }
}
