import Phaser from 'phaser'
import { ROOMS, roomObjects } from '../maps/rooms'
import type { RoomId, RoomInteraction } from '../maps/rooms'
import type MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import DoorAnimator from './DoorAnimator'
import { MONO_FONT, UI_FONT, crispText } from '../render/renderScale'
import { ROOM_THEMES } from './roomThemes'
import {
  BOARD_MESSAGES, CiPipeline, LOBBY_ANNOUNCEMENTS, MEETING_AGENDA, RACK_LABELS, ServerAlert, detectArrivals, nextDelay, rotate,
} from './roomEventLogic'

/** Scene이 사용하는 방 연출 핸들. 문·장식·이벤트를 한 번에 정리한다. */
export type RoomFx = {
  doors: DoorAnimator
  /** 이벤트가 E 입력을 대신 처리했다면 true (예: 서버실 경보 냉각) */
  intercept(target: RoomInteraction): boolean
  /** 이벤트 중 안내 문구를 바꿀 때만 값을 돌려준다. */
  hint(target: RoomInteraction): string | undefined
  setTableTalk(active: boolean): void
  destroy(): void
}

type Options = { from?: RoomId; client: MultiplayerClient }
const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color
const BANNER_DEPTH = 1100
const DIM_DEPTH = 900

/**
 * 방 분위기 장식(조명·창문·스크린·파티클)과 방마다 다른 이벤트를 만든다.
 * 이벤트는 각 브라우저에서만 재생되는 연출이며 서버 상태를 바꾸지 않는다.
 */
export function createRoomFx(scene: Phaser.Scene, roomId: RoomId, options: Options): RoomFx {
  const doors = new DoorAnimator(scene, roomId)
  const arrival = options.from ? ROOMS[roomId].doors.find(door => door.target === options.from)?.id : undefined
  doors.arriveThrough(arrival)
  const banner = new Banner(scene, ROOM_THEMES[roomId].page.accent)
  const builders = { lobby: lobbyFx, 'development-lab': developmentFx, 'server-room': serverFx, 'meeting-room': meetingFx } as const
  const room = builders[roomId](new Context(scene, banner, options))
  if (roomId !== 'lobby') banner.show(`${ROOMS[roomId].name}에 들어왔어요`)
  return {
    doors,
    intercept: target => room.intercept?.(target) ?? false,
    hint: target => room.hint?.(target),
    setTableTalk: active => room.setTableTalk?.(active),
    destroy: () => { room.destroy?.(); banner.destroy() },
  }
}

type RoomHandlers = Partial<Pick<RoomFx, 'intercept' | 'hint' | 'setTableTalk' | 'destroy'>>

/** 방 연출 공통 도구: 반복 일정, 조명, 배너 */
class Context {
  readonly scene: Phaser.Scene
  readonly banner: Banner
  readonly options: Options
  private stopped = false
  constructor(scene: Phaser.Scene, banner: Banner, options: Options) { this.scene = scene; this.banner = banner; this.options = options }

  /** min~max 간격으로 반복한다. Scene 종료 시 Phaser 시계가 함께 정리한다. */
  every(min: number, max: number, run: () => void, first = nextDelay(min, max)) {
    const tick = () => { if (this.stopped) return; run(); this.scene.time.delayedCall(nextDelay(min, max), tick) }
    this.scene.time.delayedCall(first, tick)
  }

  glow(x: number, y: number, color: string | number, scaleX: number, scaleY = scaleX, alpha = 0.3, depth = 850) {
    return this.scene.add.image(x, y, 'glow').setTint(typeof color === 'string' ? hex(color) : color)
      .setScale(scaleX, scaleY).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth)
  }

  /** 한글은 UI 글꼴, 코드·영문 표시는 고정폭 글꼴로 렌더 배율에 맞춰 그린다. */
  text(x: number, y: number, value: string, size: number, color: string, depth = 70, mono = false) {
    return crispText(this.scene, x, y, value, { fontFamily: mono ? MONO_FONT : UI_FONT, fontSize: `${size}px`, color, align: 'center' })
      .setOrigin(0.5).setDepth(depth)
  }

  stop() { this.stopped = true }
}

/** 화면 위쪽에 잠시 내려왔다 사라지는 안내 띠. 한 번에 하나만 표시한다. */
class Banner {
  private readonly scene: Phaser.Scene
  private readonly accent: number
  private current?: Phaser.GameObjects.Container
  constructor(scene: Phaser.Scene, accent: string) { this.scene = scene; this.accent = hex(accent) }

  show(message: string, color?: string, holdMs = 2600) {
    this.current?.destroy()
    const text = crispText(this.scene, 0, 0, message, { fontSize: '15px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5)
    const width = Math.min(740, text.width + 40)
    const box = this.scene.add.rectangle(0, 0, width, 34, 0x0b0f14, 0.85).setStrokeStyle(2, color ? hex(color) : this.accent)
    const container = this.scene.add.container(400, 70, [box, text]).setDepth(BANNER_DEPTH).setAlpha(0)
    this.current = container
    this.scene.tweens.add({ targets: container, y: 98, alpha: 1, duration: 260, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: container, alpha: 0, y: 88, delay: 260 + holdMs, duration: 320, onComplete: () => { if (this.current === container) this.current = undefined; container.destroy() } })
  }

  destroy() { this.current?.destroy(); this.current = undefined }
}

/** 로비: 창문과 샹들리에, 안내판, 안내 방송, 도착 환영 */
function lobbyFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  for (const x of [150, 650]) {
    scene.add.image(x, 32, 'lobby-window').setScale(2).setDepth(61)
    ctx.glow(x, 110, '#fff2c8', 3, 4, 0.18, -40)
  }
  scene.add.image(400, 32, 'lobby-board').setScale(2).setDepth(61)
  const board = ctx.text(400, 32, BOARD_MESSAGES[0], 10, '#ffd89a', 62, true)
  let boardIndex = 0
  ctx.every(5000, 5000, () => {
    scene.tweens.add({ targets: board, alpha: 0, duration: 200, yoyo: true, onYoyo: () => board.setText(rotate(BOARD_MESSAGES, ++boardIndex)) })
  })
  scene.add.image(400, 84, 'chandelier').setScale(2).setDepth(140)
  const warm = ctx.glow(400, 130, '#ffd89a', 10, 7, 0.22, -30)
  scene.tweens.add({ targets: warm, alpha: 0.3, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  const sparkle = scene.add.particles(0, 0, 'spark', {
    emitting: false, lifespan: 900, speed: { min: 30, max: 110 }, gravityY: 90, scale: { start: 2, end: 0 },
    alpha: { start: 1, end: 0 }, tint: [0xffd89a, 0xfff2b8, 0xe0b867],
  }).setDepth(950)

  ctx.banner.show(ctx.options.from ? '중앙 로비로 돌아왔어요' : '슬개기술연구소 중앙 로비에 오신 것을 환영합니다')
  let announcement = 0
  ctx.every(35000, 55000, () => {
    ctx.banner.show('♪ 안내 방송 · ' + rotate(LOBBY_ANNOUNCEMENTS, announcement++), '#e0b867', 3600)
    sparkle.explode(24, 400, 100)
  })

  // 다른 연구원이 로비에 들어오면 반겨 준다.
  let known: Set<string> | null = null
  const unsubscribe = ctx.options.client.subscribe({ snapshot: (players, selfId) => {
    for (const player of detectArrivals(known, players, selfId)) {
      ctx.banner.show(`${player.nickname} 님이 로비에 도착했어요`, '#e0b867')
      sparkle.explode(18, player.x, player.y - 24)
    }
    known = new Set(players.map(player => player.id))
  } })
  return { destroy: () => { ctx.stop(); unsubscribe() } }
}

const CODE_LINES = ['const lab = build()', 'await deploy(main)', 'if (ok) ship()', 'test("door")', 'git push origin', 'npm run build', 'fn main() {}', 'SELECT * FROM idea', 'return 42']

/** 개발 연구실: 네온 조명, 코드 패널, CI 빌드 스크린 */
function developmentFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  const strip = scene.add.rectangle(400, 66, 752, 3, 0x39e6b4, 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(61)
  scene.tweens.add({ targets: strip, alpha: 0.35, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  for (const x of [180, 620]) {
    const monitor = ctx.glow(x, 196, '#39e6b4', 4, 2.4, 0.28, 400)
    scene.tweens.add({ targets: monitor, alpha: 0.16, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2600 + x })
  }
  // 양쪽 벽의 코드 패널이 한 줄씩 흘러간다.
  const panels = [120, 680].map(x => {
    scene.add.rectangle(x, 32, 150, 44, 0x05080d, 0.9).setStrokeStyle(1, 0x1f4d6b).setDepth(61)
    return ctx.text(x, 32, '', 9, '#39e6b4', 62, true)
  })
  let line = 0
  const scroll = () => { panels.forEach((panel, i) => panel.setText([0, 1, 2].map(n => rotate(CODE_LINES, line + n + i * 4)).join('\n'))); line++ }
  scroll()
  scene.time.addEvent({ delay: 420, loop: true, callback: scroll })

  scene.add.image(400, 34, 'dev-screen').setScale(2).setDepth(61)
  const title = ctx.text(400, 20, 'CI · main', 10, '#38bdf8', 62, true)
  const status = ctx.text(400, 37, 'IDLE · 다음 빌드 대기 중', 12, '#8fb3c9', 62)
  scene.add.rectangle(400, 52, 160, 4, 0x1b2538).setDepth(62)
  const bar = scene.add.rectangle(320, 52, 160, 4, 0x39e6b4).setOrigin(0, 0.5).setScale(0, 1).setDepth(63)
  const confetti = scene.add.particles(0, 0, 'confetti', {
    emitting: false, lifespan: 1600, speed: { min: 80, max: 220 }, angle: { min: 20, max: 160 }, gravityY: 220, rotate: { min: 0, max: 360 },
    scale: 2, alpha: { start: 1, end: 0.2 }, tint: [0x39e6b4, 0x38bdf8, 0xc084fc, 0xfacc15],
  }).setDepth(950)
  const pipeline = new CiPipeline()
  ctx.every(20000, 32000, () => {
    const run = pipeline.next()
    title.setText(`CI · main · #${run.number}`)
    status.setText(`▶ BUILD #${run.number} RUNNING…`).setColor('#facc15')
    bar.setFillStyle(0x39e6b4).setScale(0, 1)
    scene.tweens.add({ targets: bar, scaleX: 1, duration: run.durationMs, ease: 'Linear', onComplete: () => {
      if (run.passed) {
        status.setText(`✔ BUILD #${run.number} PASSED`).setColor('#39e6b4')
        confetti.explode(60, 400, 70)
        ctx.banner.show(`빌드 #${run.number} 성공! 모든 테스트 통과`, '#39e6b4')
      } else {
        status.setText(`✖ BUILD #${run.number} FAILED`).setColor('#f87171')
        bar.setFillStyle(0xf87171)
        scene.cameras.main.shake(180, 0.003)
        const flash = scene.add.rectangle(400, 300, 800, 600, 0xef4444, 0.18).setDepth(DIM_DEPTH)
        scene.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() })
        ctx.banner.show(`빌드 #${run.number} 실패 · 테스트 ${run.failedTests}개 확인 필요`, '#f87171')
      }
    } })
  }, 3000)
  return { destroy: () => ctx.stop() }
}

/** 서버실: 차가운 조명, 깜빡이는 LED, 냉기 파티클, 과열 경보 이벤트 */
function serverFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  ctx.glow(400, 320, '#5fb6ff', 26, 12, 0.12, -40)
  scene.add.image(400, 30, 'server-sign').setScale(3, 2).setDepth(61)
  const temperature = ctx.text(400, 30, 'SERVER ROOM · 18°C', 10, '#e2b33c', 62, true)
  const alarms = [250, 550].map(x => {
    scene.add.image(x, 32, 'alarm-light').setScale(2).setDepth(61)
    return ctx.glow(x, 34, '#ef4444', 3, 3, 0, 62)
  })
  const racks = roomObjects('server-room').filter(object => object.texture === 'rack')
  const leds = racks.flatMap(rack => Array.from({ length: 6 }, (_, row) => [0, 1, 2].map(column =>
    scene.add.rectangle(rack.x + 10 + column * 4, rack.bottom - 128 + 14 + row * 16, 2, 2, column ? 0x22c55e : 0x5fb6ff).setDepth(rack.bottom + 1))).flat())
  scene.time.addEvent({ delay: 160, loop: true, callback: () => { for (const led of leds) if (Math.random() < 0.18) led.setAlpha(led.alpha > 0.5 ? 0.2 : 1) } })
  const vents = scene.add.particles(0, 0, 'dot', {
    x: { min: 100, max: 700 }, y: { min: 300, max: 350 }, speedY: { min: -26, max: -10 }, speedX: { min: -4, max: 4 },
    lifespan: 1800, frequency: 110, scale: { start: 1, end: 2.5 }, alpha: { start: 0.45, end: 0 }, tint: 0xa9d8ff,
  }).setDepth(-20)
  const burst = scene.add.particles(0, 0, 'dot', {
    emitting: false, lifespan: 900, speed: { min: 60, max: 180 }, scale: { start: 2, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xa9d8ff, 0xffffff],
  }).setDepth(950)

  const alert = new ServerAlert()
  let hot: Phaser.GameObjects.Image | undefined
  let siren: Phaser.Tweens.Tween | undefined
  const calm = (message: string) => {
    hot?.destroy(); hot = undefined
    siren?.stop(); siren = undefined
    for (const light of alarms) light.setAlpha(0)
    temperature.setText('SERVER ROOM · 18°C').setColor('#e2b33c')
    vents.setFrequency(110)
    ctx.banner.show(message, '#5fb6ff')
  }
  ctx.every(28000, 45000, () => {
    const index = Math.floor(Math.random() * racks.length)
    const rack = racks[index]!
    if (!alert.trigger(scene.time.now, RACK_LABELS[index] ?? 'R-01')) return
    hot = ctx.glow(rack.x, rack.bottom - 64, '#ef4444', 3, 5, 0.1, 870)
    siren = scene.tweens.add({ targets: [hot, ...alarms], alpha: 0.7, duration: 420, yoyo: true, repeat: -1 })
    temperature.setText('SERVER ROOM · 31°C ▲').setColor('#f87171')
    vents.setFrequency(400)
    ctx.banner.show(`⚠ 랙 ${RACK_LABELS[index]} 온도 상승! 랙 앞에서 E로 냉각하세요`, '#ef4444', 3200)
  }, 8000)
  scene.time.addEvent({ delay: 500, loop: true, callback: () => { if (alert.update(scene.time.now) === 'auto') calm('자동 냉각 완료 · 18°C 정상') } })

  return {
    hint: target => target.kind === 'server-status' && alert.state.active ? 'E · 냉각 시스템 가동' : undefined,
    intercept: target => {
      if (target.kind !== 'server-status' || alert.resolve() !== 'manual') return false
      burst.explode(50, target.x, target.y + 30)
      calm('❄ 냉각 완료! 온도가 정상으로 돌아왔어요')
      return true
    },
    destroy: () => ctx.stop(),
  }
}

/** 회의실: 창문·시계·화이트보드 안건, 커피 김, 테이블 대화 회의 모드 */
function meetingFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  for (const x of [150, 650]) {
    scene.add.image(x, 32, 'meeting-window').setScale(2).setDepth(61)
    ctx.glow(x, 110, '#fff2c8', 3, 4, 0.16, -40)
  }
  scene.add.image(540, 32, 'clock-face').setScale(2).setDepth(61)
  const hands = scene.add.graphics().setDepth(62)
  const drawClock = () => {
    const now = new Date()
    const minute = (now.getMinutes() / 60) * Math.PI * 2, hour = ((now.getHours() % 12 + now.getMinutes() / 60) / 12) * Math.PI * 2
    hands.clear().lineStyle(2, 0x5f3d24).lineBetween(540, 32, 540 + Math.sin(hour) * 6, 32 - Math.cos(hour) * 6)
      .lineStyle(1, 0x8c2f39).lineBetween(540, 32, 540 + Math.sin(minute) * 9, 32 - Math.cos(minute) * 9)
  }
  drawClock()
  scene.time.addEvent({ delay: 1000, loop: true, callback: drawClock })

  scene.add.image(260, 32, 'meeting-sign').setScale(2).setDepth(61)
  const sign = ctx.text(260, 32, '회의 대기', 12, '#c4b8a2', 62)
  const agenda = ctx.text(400, 86, MEETING_AGENDA[0], 11, '#1e293b', 200)
  let item = 0
  ctx.every(9000, 9000, () => scene.tweens.add({ targets: agenda, alpha: 0, duration: 220, yoyo: true, onYoyo: () => agenda.setText(rotate(MEETING_AGENDA, ++item)) }))

  const pendant = ctx.glow(400, 250, '#ffe2b0', 9, 5, 0.2, -30)
  for (const x of [376, 424]) {
    scene.add.particles(x, 228, 'dot', { speedY: { min: -14, max: -6 }, speedX: { min: -3, max: 3 }, lifespan: 1400, frequency: 380, scale: { start: 1, end: 2 }, alpha: { start: 0.35, end: 0 } }).setDepth(320)
  }
  const dim = scene.add.rectangle(400, 300, 800, 600, 0x0b0805, 0).setDepth(DIM_DEPTH)
  const spot = ctx.glow(400, 290, '#ffe2b0', 12, 7, 0, DIM_DEPTH + 1)
  return {
    setTableTalk: active => {
      scene.tweens.killTweensOf([dim, spot, pendant])
      scene.tweens.add({ targets: dim, fillAlpha: active ? 0.32 : 0, duration: 420 })
      scene.tweens.add({ targets: spot, alpha: active ? 0.38 : 0, duration: 420 })
      scene.tweens.add({ targets: pendant, alpha: active ? 0.05 : 0.2, duration: 420 })
      sign.setText(active ? '● 회의 중' : '회의 대기').setColor(active ? '#f87171' : '#c4b8a2')
      ctx.banner.show(active ? '회의 모드 · 테이블 주변 사람에게만 대화가 전달돼요' : '회의 모드를 마쳤어요', ROOM_THEMES['meeting-room'].page.accent)
    },
    destroy: () => ctx.stop(),
  }
}
