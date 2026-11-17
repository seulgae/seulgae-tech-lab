import Phaser from 'phaser'
import type { Context } from './fxContext'
import { hex } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { SKY_LABELS, SKY_PALETTES, skyPhase } from './timeOfDay'
import type { SkyPhase } from './timeOfDay'
import { localDay } from './roomEventLogic'
import {
  BITE_WINDOW_MS, FISH_LOG_KEY, REEL_TIMEOUT_MS, catchMessage, catchZone, inZone, needleAt, recordCatch, rollCatch, waitBeforeBite,
} from './fishingLogic'
import type { Catch } from './fishingLogic'
import { playSfx } from '../../audio/AudioManager'

/** 공유 맵과 같은 물 영역: 호수, 강(다리 자리 y 328~382 제외), 낚시 데크 */
const LAKE = { x: 70, y: 180, width: 260, height: 140 }
const RIVER = { x: 640, width: 60, top: 64, bridgeTop: 328, bridgeBottom: 382, bottom: 576 }
const DOCK = { x: 594, y: 450, width: 48, height: 40 }
const OVERLAY_DEPTH = 880
/** 다리·데크는 걸어 다니는 바닥이라 물(-44~-42) 바로 위, 모든 캐릭터(깊이 = 발 y)보다 아래에 그린다. */
export const WALKABLE_DECK_DEPTH = -41
const POPUP_DEPTH = 1001

/** 시간대별 화면 전체 빛(색·세기)과 물 색 */
const AMBIENCE: Record<SkyPhase, { tint: string; alpha: number; water: string; waterLight: string }> = {
  dawn: { tint: '#0b1026', alpha: 0.5, water: '#16233f', waterLight: '#3a4f86' },
  'early-morning': { tint: '#ff9e6e', alpha: 0.12, water: '#5d86c2', waterLight: '#ffd4b0' },
  morning: { tint: '#fff2cc', alpha: 0.04, water: '#3f95dd', waterLight: '#cfeaff' },
  noon: { tint: '#ffffff', alpha: 0, water: '#358bd6', waterLight: '#e6f5ff' },
  sunset: { tint: '#ff7a3d', alpha: 0.2, water: '#a8676a', waterLight: '#ffc58a' },
  evening: { tint: '#141a3a', alpha: 0.42, water: '#1d2b55', waterLight: '#6f7fc4' },
}
const NIGHT: SkyPhase[] = ['dawn', 'evening']

/** 같은 배치가 나오도록 고정 씨앗으로 만든 의사 난수(꽃·풀 위치) */
function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 } }

/**
 * 바깥 초원: 시간대에 따라 바뀌는 하늘·빛·물, 호수와 강·다리·낚시 데크, 꽃과 풀, 낮의 나비·새·구름 그림자와 밤의 반딧불이·별.
 * 강가 데크에서는 낚시 미니게임을 한다. 모든 연출은 각 브라우저에서만 돈다.
 */
export function outdoorFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  drawGround(ctx)
  let phase = skyPhase(new Date())
  let layer = drawPhase(ctx, phase)
  ctx.banner.show(`연구소 밖으로 나왔어요 · ${SKY_LABELS[phase]}`, '#a7d98a')
  scene.time.addEvent({ delay: 60_000, loop: true, callback: () => {
    const next = skyPhase(new Date())
    if (next === phase) return
    phase = next
    layer.destroy(true)
    layer = drawPhase(ctx, phase)
  } })
  const fishing = fishingGame(ctx, () => phase)
  return {
    intercept: target => target.kind === 'fishing' ? fishing.press() : false,
    hint: target => target.kind === 'fishing' ? fishing.hint() : undefined,
    locksMovement: () => fishing.busy(),
    destroy: () => { ctx.stop(); fishing.destroy() },
  }
}

/** 시간과 관계없는 땅: 가장자리 덤불, 연구소 외벽, 호수·강 테두리, 다리·데크, 꽃·풀 */
function drawGround(ctx: Context) {
  const { scene } = ctx
  const g = scene.add.graphics().setDepth(-60)
  // 왼쪽·오른쪽·아래 덤불 울타리(충돌 벽 자리)
  for (let y = 64; y < 600; y += 16) for (const x of [0, 776]) {
    g.fillStyle(0x2e5c2b, 1).fillRect(x, y, 24, 16)
    g.fillStyle(0x3f7a3a, 1).fillCircle(x + 6 + (y % 32 ? 6 : 0), y + 6, 7)
    g.fillStyle(0x5aa84f, 1).fillCircle(x + 5 + (y % 32 ? 6 : 0), y + 4, 3)
  }
  for (let x = 0; x < 800; x += 16) {
    g.fillStyle(0x2e5c2b, 1).fillRect(x, 576, 16, 24)
    g.fillStyle(0x3f7a3a, 1).fillCircle(x + 8, 580, 8)
  }
  // 연구소 외벽: 아래 가운데, 문(DoorAnimator) 뒤
  const wall = scene.add.graphics().setDepth(-55)
  wall.fillStyle(0x6b5a4a, 1).fillRect(280, 548, 240, 52)
  for (let y = 548; y < 600; y += 8) for (let x = 280 + ((y / 8) % 2) * 8; x < 520; x += 16) wall.fillStyle(0x7d6a57, 1).fillRect(x, y, 14, 6)
  wall.fillStyle(0x3b2418, 1).fillRect(272, 542, 256, 8)
  wall.fillStyle(0xc9a24b, 1).fillRect(272, 542, 256, 2)

  // 호수: 모래 테두리 → 물(시간대 층이 다시 칠함) → 연잎
  g.fillStyle(0xd9c99a, 1).fillRoundedRect(LAKE.x - 6, LAKE.y - 6, LAKE.width + 12, LAKE.height + 12, 22)
  g.fillStyle(0xbfae80, 1).fillRoundedRect(LAKE.x - 2, LAKE.y - 2, LAKE.width + 4, LAKE.height + 4, 18)
  // 강 둑
  for (const [top, bottom] of [[RIVER.top, RIVER.bridgeTop], [RIVER.bridgeBottom, RIVER.bottom]] as const) {
    g.fillStyle(0x8a6f45, 1).fillRect(RIVER.x - 5, top, RIVER.width + 10, bottom - top)
  }
  // 다리(강을 가로지르는 나무 판)
  const bridge = scene.add.graphics().setDepth(WALKABLE_DECK_DEPTH)
  bridge.fillStyle(0x5a3a2a, 1).fillRect(626, RIVER.bridgeTop - 4, 88, RIVER.bridgeBottom - RIVER.bridgeTop + 8)
  for (let x = 628; x < 712; x += 8) bridge.fillStyle(x % 16 ? 0x8f6446 : 0x7a5238, 1).fillRect(x, RIVER.bridgeTop - 2, 7, RIVER.bridgeBottom - RIVER.bridgeTop + 4)
  bridge.fillStyle(0x3b2418, 1).fillRect(626, RIVER.bridgeTop - 8, 88, 4).fillRect(626, RIVER.bridgeBottom + 2, 88, 4)
  // 낚시 데크
  const dock = scene.add.graphics().setDepth(WALKABLE_DECK_DEPTH)
  dock.fillStyle(0x3b2418, 1).fillRect(DOCK.x - 2, DOCK.y - 2, DOCK.width + 4, DOCK.height + 4)
  for (let y = DOCK.y; y < DOCK.y + DOCK.height; y += 8) dock.fillStyle(y % 16 ? 0x9a6c48 : 0x8a5f3e, 1).fillRect(DOCK.x, y, DOCK.width, 7)
  dock.fillStyle(0x2a1a12, 1).fillRect(DOCK.x + DOCK.width - 4, DOCK.y - 6, 4, 10).fillRect(DOCK.x + DOCK.width - 4, DOCK.y + DOCK.height - 4, 4, 10)
  ctx.text(DOCK.x + DOCK.width / 2, DOCK.y - 14, '낚시터', 10, '#fff2d2', DOCK.y - 1).setBackgroundColor('#3b2418cc').setPadding(4, 1)

  // 꽃과 풀(물·나무·길·문 근처는 피한다)
  const random = seeded(20261117)
  const blocked = (x: number, y: number) => (x > LAKE.x - 20 && x < LAKE.x + LAKE.width + 20 && y > LAKE.y - 20 && y < LAKE.y + LAKE.height + 20)
    || (x > RIVER.x - 24 && x < RIVER.x + RIVER.width + 24) || (x > 370 && x < 430 && y > 300) || (y > 520 && x > 260 && x < 540)
  const flowers = scene.add.graphics().setDepth(-45)
  const colors = [0xfff6c9, 0xf6a5c0, 0xc7b4ff, 0xffd166, 0xffffff]
  for (let i = 0; i < 90; i++) {
    const x = 32 + random() * 736, y = 80 + random() * 488
    if (blocked(x, y)) continue
    const color = colors[Math.floor(random() * colors.length)]!
    flowers.fillStyle(0x4f8c45, 1).fillRect(x, y + 2, 1, 4)
    flowers.fillStyle(color, 1).fillRect(x - 2, y, 2, 2).fillRect(x + 1, y, 2, 2).fillRect(x - 1, y - 2, 2, 2).fillRect(x - 1, y + 1, 2, 2)
    flowers.fillStyle(0xf2b33d, 1).fillRect(x - 0.5, y - 0.5, 1, 1)
  }
  for (let i = 0; i < 28; i++) {
    const x = 36 + random() * 728, y = 90 + random() * 470
    if (blocked(x, y)) continue
    const tuft = scene.add.graphics({ x, y }).setDepth(y)
    tuft.fillStyle(0x3f7a3a, 1).fillTriangle(-6, 0, -3, -12, 0, 0).fillTriangle(-2, 0, 1, -15, 4, 0).fillTriangle(2, 0, 6, -10, 8, 0)
    tuft.fillStyle(0x5aa84f, 1).fillTriangle(-1, 0, 1, -11, 2, 0)
    scene.tweens.add({ targets: tuft, angle: { from: -4, to: 4 }, duration: 1600 + random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: random() * 1000 })
  }
}

/** 시간대에 따라 바뀌는 층: 하늘·해달별·먼 산, 물 색과 반짝임, 화면 빛, 낮/밤 생물 */
function drawPhase(ctx: Context, phase: SkyPhase) {
  const { scene } = ctx
  const sky = SKY_PALETTES[phase]
  const mood = AMBIENCE[phase]
  const night = NIGHT.includes(phase)
  const layer = scene.add.container(0, 0)
  // 깊이가 서로 다른 오브젝트들이라 container에 넣지 않고, 빈 container를 수명 핸들로 써서 함께 지운다.
  const loose: Phaser.GameObjects.GameObject[] = []
  const keep = <T extends Phaser.GameObjects.GameObject>(object: T) => { loose.push(object); return object }
  layer.once(Phaser.GameObjects.Events.DESTROY, () => loose.forEach(object => object.destroy()))

  // 하늘: 위·가운데·지평선 색을 8단으로 섞는다.
  const band = keep(scene.add.graphics().setDepth(58))
  const colors = [sky.top, sky.middle, sky.horizon].map(color => Phaser.Display.Color.HexStringToColor(color))
  for (let i = 0; i < 8; i++) {
    const t = i / 7, from = t < 0.5 ? colors[0]! : colors[1]!, to = t < 0.5 ? colors[1]! : colors[2]!, local = t < 0.5 ? t * 2 : (t - 0.5) * 2
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(local * 100))
    band.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i * 7, 800, 8)
  }
  if (sky.sun) {
    const sx = 40 + sky.sun.x * 24, sy = 8 + sky.sun.y * 2.4
    keep(ctx.glow(sx, sy, sky.sun.color, 3, 3, 0.55, 59))
    band.fillStyle(hex(sky.sun.color), 1).fillCircle(sx, sy, 7)
  }
  if (sky.moon) {
    const mx = 40 + sky.moon.x * 24, my = 10 + sky.moon.y * 2
    band.fillStyle(0xf4f1de, 1).fillCircle(mx, my, 6)
    band.fillStyle(hex(sky.top), 1).fillCircle(mx + 3, my - 2, 5)
  }
  if (sky.stars) {
    const random = seeded(7)
    for (let i = 0; i < 40; i++) {
      const star = keep(scene.add.rectangle(random() * 800, random() * 38, 1.5, 1.5, 0xffffff, 0.9).setDepth(59))
      scene.tweens.add({ targets: star, alpha: 0.2, duration: 600 + random() * 1600, yoyo: true, repeat: -1, delay: random() * 2000 })
    }
  }
  // 먼 산과 숲 경계(지평선)
  const hills = keep(scene.add.graphics().setDepth(59))
  const far = night ? 0x1d2a3a : phase === 'sunset' ? 0x6a4a6e : 0x7da0b8
  const near = night ? 0x14231a : phase === 'sunset' ? 0x3b3a2a : 0x2f6b30
  hills.fillStyle(far, 1)
  for (let x = 0; x < 800; x += 4) hills.fillRect(x, 40 + Math.round(8 * Math.sin(x / 70) + 5 * Math.sin(x / 23)), 4, 30)
  hills.fillStyle(near, 1)
  for (let x = 0; x < 800; x += 8) hills.fillCircle(x + 4, 58 + Math.round(3 * Math.sin(x * 1.7)), 8)
  hills.fillRect(0, 58, 800, 8)

  // 구름(낮): 하늘 띠를 천천히 흐른다.
  if (!night) for (let i = 0; i < 4; i++) {
    const cloud = keep(scene.add.graphics({ x: i * 220 + 40, y: 12 + (i % 2) * 10 }).setDepth(59))
    const shade = phase === 'sunset' ? 0xffd2b0 : 0xffffff
    cloud.fillStyle(shade, 0.85).fillEllipse(0, 0, 44, 12).fillEllipse(-12, -4, 22, 12).fillEllipse(10, -5, 24, 14)
    scene.tweens.add({ targets: cloud, x: cloud.x + 860, duration: 90000 + i * 15000, repeat: -1, onRepeat: () => { cloud.x = -60 } })
  }

  // 물: 시간대 색, 반짝임, 강물 흐름
  const water = keep(scene.add.graphics().setDepth(-44))
  water.fillStyle(hex(mood.water), 1).fillRoundedRect(LAKE.x, LAKE.y, LAKE.width, LAKE.height, 16)
  water.fillStyle(hex(mood.water), 1).fillRect(RIVER.x, RIVER.top, RIVER.width, RIVER.bridgeTop - RIVER.top)
  water.fillRect(RIVER.x, RIVER.bridgeBottom, RIVER.width, RIVER.bottom - RIVER.bridgeBottom)
  // 연잎과 물에 비친 해·달
  water.fillStyle(0x3f8a3c, 1).fillEllipse(120, 210, 16, 10).fillEllipse(270, 290, 14, 9).fillEllipse(300, 214, 12, 8)
  water.fillStyle(0xf6a5c0, 1).fillRect(118, 208, 3, 3)
  if (sky.sun || sky.moon) keep(ctx.glow(220, 240, sky.sun?.color ?? '#f4f1de', 3, 1.2, night ? 0.25 : 0.35, -43))
  const random = seeded(phase.length * 31)
  for (let i = 0; i < 14; i++) {
    const inLake = i < 9
    const x = inLake ? LAKE.x + 20 + random() * (LAKE.width - 40) : RIVER.x + 8 + random() * (RIVER.width - 16)
    const y = inLake ? LAKE.y + 16 + random() * (LAKE.height - 32) : RIVER.top + random() * (RIVER.bottom - RIVER.top)
    if (!inLake && y > RIVER.bridgeTop - 6 && y < RIVER.bridgeBottom + 6) continue
    const sparkle = keep(scene.add.rectangle(x, y, inLake ? 8 : 6, 1, hex(mood.waterLight), 0.8).setDepth(-42))
    scene.tweens.add({ targets: sparkle, alpha: 0, duration: 900 + random() * 900, yoyo: true, repeat: -1, delay: random() * 1500 })
  }
  for (const [top, bottom] of [[RIVER.top, RIVER.bridgeTop], [RIVER.bridgeBottom, RIVER.bottom]] as const) {
    keep(scene.add.particles(0, 0, 'dot', {
      x: { min: RIVER.x + 4, max: RIVER.x + RIVER.width - 4 }, y: top, speedY: { min: 26, max: 44 }, lifespan: (bottom - top) / 35 * 1000,
      frequency: 160, scale: { start: 1.5, end: 1 }, alpha: { start: 0.5, end: 0 }, tint: hex(mood.waterLight),
    }).setDepth(-42))
  }

  // 화면 전체의 시간대 빛. 이름표(900)보다 아래라 밤에도 이름은 잘 보인다.
  if (mood.alpha > 0) keep(scene.add.rectangle(400, 300, 800, 600, hex(mood.tint), mood.alpha).setDepth(OVERLAY_DEPTH))

  if (night) {
    // 반딧불이와 연구소 창문 불빛, 가로등
    keep(scene.add.particles(0, 0, 'dot', {
      x: { min: 40, max: 600 }, y: { min: 90, max: 540 }, lifespan: 3200, frequency: 260, speedX: { min: -8, max: 8 }, speedY: { min: -10, max: 6 },
      scale: { start: 1.5, end: 0.5 }, alpha: { start: 0, end: 1, ease: (t: number) => Math.sin(t * Math.PI) }, tint: [0xd9ff7a, 0xfff2a8],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(OVERLAY_DEPTH + 1))
    for (const x of [306, 338, 462, 494]) keep(ctx.glow(x, 572, '#ffd89a', 1.2, 1, 0.8, OVERLAY_DEPTH + 1))
    keep(ctx.glow(470, 500, '#ffd89a', 5, 4, 0.35, OVERLAY_DEPTH + 1))
  } else {
    // 나비와 구름 그림자, 하늘을 지나는 새
    for (let i = 0; i < 3; i++) {
      const butterfly = keep(scene.add.rectangle(120 + i * 180, 420 - i * 60, 4, 3, [0xfff6c9, 0xf6a5c0, 0xc7b4ff][i]!).setDepth(560))
      scene.tweens.add({ targets: butterfly, x: butterfly.x + 60 + i * 20, y: butterfly.y - 40, duration: 3200 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      scene.tweens.add({ targets: butterfly, scaleX: 0.3, duration: 140, yoyo: true, repeat: -1 })
    }
    const shadow = keep(scene.add.ellipse(-120, 260, 220, 90, 0x000000, 0.07).setDepth(OVERLAY_DEPTH - 1))
    scene.tweens.add({ targets: shadow, x: 920, duration: 70000, repeat: -1 })
    ctx.every(15000, 30000, () => {
      if (!band.active) return
      const bird = scene.add.text(-10, 10 + Math.random() * 20, 'v', { fontFamily: 'monospace', fontSize: '10px', color: '#1f2a33' }).setDepth(59)
      scene.tweens.add({ targets: bird, x: 820, y: bird.y - 6, duration: 9000, onComplete: () => bird.destroy() })
    }, 3000)
  }
  return layer
}

type State = 'idle' | 'cast' | 'wait' | 'bite' | 'reel' | 'result'
const FISH_TINT: Record<string, number> = {
  minnow: 0xc9d6e3, crucian: 0xc7a04a, mandarin: 0xb89a4e, catfish: 0x6b5a48, trout: 0xe39aa8, 'golden-carp': 0xffd23f,
}

/** 강가 낚시: 찌 던지기 → 입질 → 게이지 맞추기 → 결과(이 브라우저 기록) */
function fishingGame(ctx: Context, currentPhase: () => SkyPhase) {
  const { scene } = ctx
  let state: State = 'idle'
  let deadline = 0
  let reelStart = 0
  let caught: Catch | undefined
  let zone = { start: 0, width: 0 }
  const line = scene.add.graphics().setDepth(POPUP_DEPTH - 2)
  const bobber = scene.add.image(0, 0, 'bobber').setScale(2).setDepth(DOCK.y + 60).setVisible(false)
  const exclaim = scene.add.image(0, 0, 'exclaim').setScale(2).setDepth(POPUP_DEPTH).setVisible(false)
  const splash = scene.add.particles(0, 0, 'dot', {
    emitting: false, lifespan: 600, speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 }, gravityY: 120, scale: { start: 1.5, end: 0 }, tint: 0xd8f1ff,
  }).setDepth(POPUP_DEPTH - 1)
  const gauge = scene.add.container(0, 0).setDepth(POPUP_DEPTH).setVisible(false)
  const gaugeBack = scene.add.rectangle(0, 0, 136, 18, 0x0b0f14, 0.9).setStrokeStyle(2, 0xfff2d2)
  const gaugeZone = scene.add.rectangle(0, 0, 10, 12, 0x4ade80, 0.95).setOrigin(0, 0.5)
  const needle = scene.add.rectangle(0, 0, 3, 22, 0xffffff)
  gauge.add([gaugeBack, gaugeZone, needle])
  const me = () => ctx.options.player?.() ?? { x: DOCK.x + 20, y: DOCK.y + 20 }

  const reset = (message?: string, color = '#a7d98a') => {
    state = 'idle'
    bobber.setVisible(false); exclaim.setVisible(false); gauge.setVisible(false); line.clear()
    scene.tweens.killTweensOf(bobber)
    if (message) ctx.banner.show(message, color, 2200)
  }

  const update = () => {
    const now = scene.time.now
    line.clear()
    if (state !== 'idle' && state !== 'result' && bobber.visible) {
      const p = me()
      line.lineStyle(1, 0xf2f2f2, 0.8).beginPath().moveTo(p.x + 10, p.y - 34).lineTo(bobber.x, bobber.y - 4).strokePath()
      line.lineStyle(2, 0x5a3a2a, 1).beginPath().moveTo(p.x + 2, p.y - 14).lineTo(p.x + 10, p.y - 34).strokePath()
    }
    if (state === 'wait' && now >= deadline) {
      state = 'bite'
      playSfx('plop', { volume: 0.8 })
      deadline = now + BITE_WINDOW_MS
      scene.tweens.killTweensOf(bobber)
      scene.tweens.add({ targets: bobber, y: bobber.y + 6, duration: 90, yoyo: true, repeat: 3 })
      splash.explode(10, bobber.x, bobber.y)
      const p = me()
      exclaim.setPosition(p.x, p.y - 64).setVisible(true)
    } else if (state === 'bite' && now > deadline) {
      playSfx('error', { volume: 0.4 })
      reset('찌만 흔들리고 도망갔어요. 입질이 오면 바로 E!', '#ffb547')
    } else if (state === 'reel') {
      const value = needleAt(now - reelStart, caught!.species.rarity)
      needle.x = -64 + value * 128
      if (now - reelStart > REEL_TIMEOUT_MS) { playSfx('error', { volume: 0.4 }); reset('물고기가 줄을 끊고 달아났어요…', '#ffb547') }
    }
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, update)

  const press = () => {
    const now = scene.time.now
    if (state === 'idle') {
      state = 'cast'
      playSfx('cast', { volume: 0.6 })
      const p = me()
      const target = { x: RIVER.x + 18 + Math.random() * 24, y: DOCK.y + 4 + Math.random() * 30 }
      bobber.setPosition(p.x, p.y - 30).setVisible(true)
      scene.tweens.add({ targets: bobber, x: target.x, duration: 420, ease: 'Sine.easeOut' })
      scene.tweens.add({ targets: bobber, y: { from: p.y - 30, to: target.y }, duration: 420, ease: 'Back.easeIn', onComplete: () => {
        if (state !== 'cast') return
        splash.explode(6, bobber.x, bobber.y)
        playSfx('plop', { volume: 0.4, rate: 1.3 })
        scene.tweens.add({ targets: bobber, y: bobber.y + 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        state = 'wait'
        deadline = scene.time.now + waitBeforeBite()
      } })
      return true
    }
    if (state === 'wait') { playSfx('click', { volume: 0.5 }); reset('아직 입질이 없었어요. 찌를 거뒀어요.'); return true }
    if (state === 'bite') {
      state = 'reel'
      caught = rollCatch(currentPhase())
      zone = catchZone(caught.species.rarity)
      reelStart = now
      exclaim.setVisible(false)
      const p = me()
      gauge.setPosition(p.x, p.y - 82).setVisible(true)
      gaugeZone.setPosition(-64 + zone.start * 128, 0).setSize(zone.width * 128, 12)
      return true
    }
    if (state === 'reel') {
      if (!inZone(needleAt(now - reelStart, caught!.species.rarity), zone)) { playSfx('error', { volume: 0.5 }); reset('아깝다! 바늘이 초록 칸에 있을 때 눌러야 해요.', '#ffb547'); return true }
      land(caught!)
      return true
    }
    return true
  }

  /** 물고기가 찌에서 캐릭터에게 튀어 오르고 기록·배너를 남긴다. */
  const land = (fish: Catch) => {
    state = 'result'
    gauge.setVisible(false)
    let message = `${fish.species.name} ${fish.cm}cm를 낚았어요!`
    try {
      const storage = globalThis.localStorage
      const { log, record } = recordCatch(storage.getItem(FISH_LOG_KEY), fish, localDay(new Date()))
      storage.setItem(FISH_LOG_KEY, JSON.stringify(log))
      message = catchMessage(fish, log, record)
    } catch { /* 저장이 막혀도 결과는 보여 준다 */ }
    const p = me()
    const sprite = scene.add.image(bobber.x, bobber.y, 'fish').setScale(2 + Math.min(fish.cm / 40, 1.5)).setTint(FISH_TINT[fish.species.id] ?? 0xffffff).setDepth(POPUP_DEPTH)
    bobber.setVisible(false); line.clear()
    splash.explode(16, sprite.x, sprite.y)
    playSfx('splash', { volume: 0.6 })
    playSfx('success', { volume: 0.6 })
    scene.tweens.add({ targets: sprite, x: p.x, duration: 520, ease: 'Sine.easeOut' })
    scene.tweens.add({ targets: sprite, y: { from: sprite.y, to: p.y - 60 }, duration: 520, ease: 'Back.easeOut', onComplete: () => {
      scene.tweens.add({ targets: sprite, angle: { from: -12, to: 12 }, duration: 120, yoyo: true, repeat: 5 })
      scene.tweens.add({ targets: sprite, alpha: 0, delay: 1400, duration: 300, onComplete: () => { sprite.destroy(); if (state === 'result') state = 'idle' } })
    } })
    if (fish.species.rarity === 'legendary' || fish.species.rarity === 'rare') ctx.glow(p.x, p.y - 60, '#ffd23f', 3, 3, 0.6, POPUP_DEPTH - 1)
    ctx.banner.show(message, fish.species.rarity === 'common' ? '#a7d98a' : '#ffd23f', 3000)
  }

  return {
    press,
    busy: () => state !== 'idle',
    hint: (): string | undefined => {
      if (state === 'cast' || state === 'result') return '…'
      if (state === 'wait') return '찌를 지켜보는 중… (E · 거두기)'
      if (state === 'bite') return 'E! 지금 챔질!'
      if (state === 'reel') return 'E · 바늘이 초록 칸에 올 때!'
      return undefined
    },
    destroy: () => { scene.events.off(Phaser.Scenes.Events.UPDATE, update) },
  }
}
