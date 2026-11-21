import Phaser from 'phaser'
import { ROOMS, roomObjects } from '../maps/rooms'
import type { RoomId, RoomInteraction } from '../maps/rooms'
import type { TreatKind } from './roomEventLogic'
import DoorAnimator from './DoorAnimator'
import { Banner, Context, DIM_DEPTH, hex } from './fxContext'
import type { Options } from './fxContext'
import { ROOM_THEMES } from './roomThemes'
import {
  BOARD_MESSAGES, CiPipeline, LOBBY_ANNOUNCEMENTS, RACK_LABELS, ServerAlert, TREAT_STORAGE_KEY, countTreat, detectArrivals, localDay,
  rotate, treatMessage,
} from './roomEventLogic'
import { SKY_PALETTES, clockAngles, clockLabel, skyPhase } from './timeOfDay'
import { AGENDAS_CHANGED, fetchAgendas } from '../../features/boards/boardsApi'
import { playSfx } from '../../audio/AudioManager'
import { SNACKS, inventoryStore } from '../../features/inventory/inventoryStore'
import { adminRoomFx } from './adminRoomFx'
import { outdoorFx } from './outdoorFx'
import { townsfolk } from '../npc/townsfolkFx.ts'
import { DEV_LAB_NPCS, LOBBY_NPCS } from '../npc/npcData.ts'

/** Scene이 사용하는 방 연출 핸들. 문·장식·이벤트를 한 번에 정리한다. */
export type RoomFx = {
  doors: DoorAnimator
  /** 이벤트가 E 입력을 대신 처리했다면 true (예: 서버실 경보 냉각) */
  intercept(target: RoomInteraction): boolean
  /** 이벤트 중 안내 문구를 바꿀 때만 값을 돌려준다. */
  hint(target: RoomInteraction): string | undefined
  /** quiet면 배너 없이 조명·표시등만 바꾼다(회의실 의자에 앉아 자동으로 켤 때). */
  setTableTalk(active: boolean, quiet?: boolean): void
  /** 낚시처럼 연출이 진행 중이라 캐릭터를 멈춰야 하면 true */
  locksMovement(): boolean
  /** 움직이는 상호작용 대상(NPC·포장마차). 공유 맵에 없는 화면 전용 대상이다. */
  targets(): RoomInteraction[]
  destroy(): void
}


/**
 * 방 분위기 장식(조명·창문·스크린·파티클)과 방마다 다른 이벤트를 만든다.
 * 이벤트는 각 브라우저에서만 재생되는 연출이며 서버 상태를 바꾸지 않는다.
 */
export function createRoomFx(scene: Phaser.Scene, roomId: RoomId, options: Options): RoomFx {
  const doors = new DoorAnimator(scene, roomId)
  const arrival = options.from ? ROOMS[roomId].doors.find(door => door.target === options.from)?.id : undefined
  doors.arriveThrough(arrival)
  const banner = new Banner(scene, ROOM_THEMES[roomId].page.accent)
  const builders = {
    lobby: lobbyFx, 'development-lab': developmentFx, 'server-room': serverFx, 'meeting-room': meetingFx,
    'control-room': adminRoomFx, outdoor: outdoorFx,
    'office-1': officeFx, 'office-2': officeFx, 'office-3': arcadeFx, 'office-4': officeFx,
  } as const
  const room = builders[roomId](new Context(scene, banner, { ...options, room: roomId }))
  const shakePlant = plantShaker(scene, options.plants ?? new Map(), banner)
  if (roomId !== 'lobby' && roomId !== 'outdoor') banner.show(`${ROOMS[roomId].name}에 들어왔어요`)
  return {
    doors,
    // 식물은 모든 방에서 E로 흔들 수 있다. 나머지는 방 이벤트가 먼저 처리할 기회를 갖는다.
    intercept: target => target.kind === 'plant' ? (shakePlant(target.id), true) : room.intercept?.(target) ?? false,
    hint: target => room.hint?.(target),
    setTableTalk: (active, quiet) => room.setTableTalk?.(active, quiet),
    locksMovement: () => room.locksMovement?.() ?? false,
    targets: () => room.targets?.() ?? [],
    destroy: () => { room.destroy?.(); banner.destroy() },
  }
}

export type RoomHandlers = Partial<Pick<RoomFx, 'intercept' | 'hint' | 'setTableTalk' | 'locksMovement' | 'targets' | 'destroy'>>


/** 로비: 창문과 샹들리에, 안내판, 안내 방송, 도착 환영 */
function lobbyFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  const sky = skyWindows(ctx, 'lobby-window')
  wallClock(ctx, 540, '#3b2418', '#8c2f39')
  scene.add.image(400, 32, 'lobby-board').setScale(2).setDepth(61)
  const board = ctx.text(400, 32, BOARD_MESSAGES[0], 10, '#ffd89a', 62, true)
  let boardIndex = 0
  ctx.every(5000, 5000, () => {
    scene.tweens.add({ targets: board, alpha: 0, duration: 200, yoyo: true, onYoyo: () => board.setText(rotate(BOARD_MESSAGES, ++boardIndex)) })
  })
  scene.add.image(400, 84, 'chandelier').setScale(2).setDepth(140)
  // 밤일수록 샹들리에를 밝힌다.
  const warm = ctx.glow(400, 130, '#ffd89a', 10, 7, 0.22 * sky.indoor, -30)
  scene.tweens.add({ targets: warm, alpha: 0.3 * sky.indoor, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  const sparkle = scene.add.particles(0, 0, 'spark', {
    emitting: false, lifespan: 900, speed: { min: 30, max: 110 }, gravityY: 90, scale: { start: 2, end: 0 },
    alpha: { start: 1, end: 0 }, tint: [0xffd89a, 0xfff2b8, 0xe0b867],
  }).setDepth(950)

  ctx.banner.show(ctx.options.from ? '중앙 로비로 돌아왔어요' : '슬개기술연구소 중앙 로비에 오신 것을 환영합니다')
  let announcement = 0
  ctx.every(35000, 55000, () => {
    playSfx('announce', { volume: 0.6 })
    ctx.banner.show('♪ 안내 방송 · ' + rotate(LOBBY_ANNOUNCEMENTS, announcement++), '#e0b867', 3600)
    sparkle.explode(24, 400, 100)
  })

  // 다른 연구원이 로비에 들어오면 반겨 준다.
  let known: Set<string> | null = null
  const unsubscribe = ctx.options.client.subscribe({ snapshot: (players, selfId) => {
    for (const player of detectArrivals(known, players, selfId)) {
      playSfx('notify', { volume: 0.4 })
      ctx.banner.show(`${player.nickname} 님이 로비에 도착했어요`, '#e0b867')
      sparkle.explode(18, player.x, player.y - 24)
    }
    known = new Set(players.map(player => player.id))
  } })
  const treats = treatTable(ctx)
  // 로비를 오가며 청소하고 궁시렁거리는 아주머니
  const cleaner = townsfolk(ctx, LOBBY_NPCS)
  return {
    targets: cleaner.targets,
    hint: cleaner.hint,
    intercept: target => {
      if (cleaner.intercept(target)) return true
      if (target.kind === 'coffee' || target.kind === 'cake') { treats.buy(target.kind); return true }
      // 책장은 책이 날아오는 연출만 하고, 책 읽기 창은 Scene이 연다.
      if (target.kind === 'bookshelf') treats.pullBook(target)
      return false
    },
    destroy: () => { ctx.stop(); unsubscribe(); cleaner.destroy() },
  }
}

const CODE_LINES = ['const lab = build()', 'await deploy(main)', 'if (ok) ship()', 'test("door")', 'git push origin', 'npm run build', 'fn main() {}', 'SELECT * FROM idea', 'return 42']

/** 개발 연구실: 네온 조명, 코드 패널, CI 빌드 스크린 */
function developmentFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  const strip = scene.add.rectangle(400, 66, 752, 3, 0x39e6b4, 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(61)
  scene.tweens.add({ targets: strip, alpha: 0.35, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  // 슈퍼컴퓨터 캐비닛 불빛이 번갈아 깜박인다.
  for (const x of [300, 400, 500]) {
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
  // 빌드 결과에 놀라고 웃는 괴짜 박사님
  const professor = townsfolk(ctx, DEV_LAB_NPCS)
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
        playSfx('success', { volume: 0.5 })
        ctx.banner.show(`빌드 #${run.number} 성공! 모든 테스트 통과`, '#39e6b4')
        professor.react(true)
      } else {
        status.setText(`✖ BUILD #${run.number} FAILED`).setColor('#f87171')
        bar.setFillStyle(0xf87171)
        scene.cameras.main.shake(180, 0.003)
        const flash = scene.add.rectangle(400, 300, 800, 600, 0xef4444, 0.18).setDepth(DIM_DEPTH)
        scene.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() })
        playSfx('error', { volume: 0.5 })
        ctx.banner.show(`빌드 #${run.number} 실패 · 테스트 ${run.failedTests}개 확인 필요`, '#f87171')
        professor.react(false)
      }
    } })
  }, 3000)
  return {
    targets: professor.targets, hint: professor.hint, intercept: professor.intercept,
    destroy: () => { ctx.stop(); professor.destroy() },
  }
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
    playSfx('alarm', { volume: 0.45 })
    ctx.banner.show(`⚠ 랙 ${RACK_LABELS[index]} 온도 상승! 랙 앞에서 E로 냉각하세요`, '#ef4444', 3200)
  }, 8000)
  scene.time.addEvent({ delay: 500, loop: true, callback: () => { if (alert.update(scene.time.now) === 'auto') calm('자동 냉각 완료 · 18°C 정상') } })

  return {
    hint: target => target.kind === 'server-status' && alert.state.active ? 'E · 냉각 시스템 가동' : undefined,
    intercept: target => {
      if (target.kind !== 'server-status' || alert.resolve() !== 'manual') return false
      burst.explode(50, target.x, target.y + 30)
      playSfx('success', { volume: 0.6 })
      calm('❄ 냉각 완료! 온도가 정상으로 돌아왔어요')
      return true
    },
    destroy: () => ctx.stop(),
  }
}

/** 회의실: 창문·시계·화이트보드 안건, 커피 김, 테이블 대화 회의 모드 */
function meetingFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  skyWindows(ctx, 'meeting-window')
  wallClock(ctx, 540, '#5f3d24', '#8c2f39')

  scene.add.image(260, 32, 'meeting-sign').setScale(2).setDepth(61)
  const sign = ctx.text(260, 32, '회의 대기', 12, '#c4b8a2', 62)
  const stopBoard = agendaBoard(ctx)

  const pendant = ctx.glow(400, 280, '#ffe2b0', 6, 9, 0.2, -30)
  // 세로 테이블 위 커피 두 잔의 김
  for (const [x, y] of [[400, 186], [400, 326]] as const) {
    scene.add.particles(x, y - 12, 'dot', { speedY: { min: -14, max: -6 }, speedX: { min: -3, max: 3 }, lifespan: 1400, frequency: 380, scale: { start: 1, end: 2 }, alpha: { start: 0.35, end: 0 } }).setDepth(430)
  }
  const dim = scene.add.rectangle(400, 300, 800, 600, 0x0b0805, 0).setDepth(DIM_DEPTH)
  const spot = ctx.glow(400, 280, '#ffe2b0', 8, 10, 0, DIM_DEPTH + 1)
  return {
    setTableTalk: (active, quiet) => {
      scene.tweens.killTweensOf([dim, spot, pendant])
      scene.tweens.add({ targets: dim, fillAlpha: active ? 0.32 : 0, duration: 420 })
      scene.tweens.add({ targets: spot, alpha: active ? 0.38 : 0, duration: 420 })
      scene.tweens.add({ targets: pendant, alpha: active ? 0.05 : 0.2, duration: 420 })
      sign.setText(active ? '● 회의 중' : '회의 대기').setColor(active ? '#f87171' : '#c4b8a2')
      if (!quiet) ctx.banner.show(active ? '회의 모드 · 테이블 주변 사람에게만 대화가 전달돼요' : '회의 모드를 마쳤어요', ROOM_THEMES['meeting-room'].page.accent)
    },
    destroy: () => { ctx.stop(); stopBoard() },
  }
}

/**
 * 화분을 누르거나 E를 누르면 흔들리며 나뭇잎이 떨어진다. 흔들리는 중에는 다시 시작하지 않는다.
 * 회원이면 서버가 5% 확률로 1~3원을 준다(식물 행운). 동전이 튀어 오르는 연출은 가방 상태의 동전 이벤트가 맡는다.
 */
function plantShaker(scene: Phaser.Scene, plants: Map<string, Phaser.GameObjects.Image>, banner: Banner) {
  const leaves = scene.add.particles(0, 0, 'leaf', {
    emitting: false, lifespan: { min: 1400, max: 2200 }, speedX: { min: -45, max: 45 }, speedY: { min: -40, max: 0 }, gravityY: 70,
    rotate: { min: 0, max: 360 }, scale: { start: 2, end: 1.5 }, alpha: { start: 1, end: 0 }, tint: [0x4f8c61, 0x73a570, 0x92ba7b, 0xb5c97a],
  }).setDepth(980)
  const shake = (id: string) => {
    const image = plants.get(id)
    if (!image || image.getData('shaking')) return
    image.setData('shaking', true)
    scene.tweens.add({ targets: image, angle: { from: -7, to: 7 }, duration: 90, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
      onComplete: () => { image.setAngle(0); image.setData('shaking', false) } })
    leaves.explode(9, image.x, image.y - image.displayHeight * 0.75)
    playSfx('leaves', { volume: 0.7 })
    void inventoryStore.shakePlant().then(won => {
      if (won > 0 && image.active) banner.show(`화분에서 동전이 떨어졌어요! +${won}원`, '#ffd23f', 2200)
    })
  }
  for (const [id, image] of plants) image.setInteractive({ useHandCursor: true }).on('pointerdown', () => shake(id))
  return shake
}

/** 창문 유리 뒤에 현재 시간대의 하늘을 깔고, 창으로 들어오는 빛 색도 맞춘다. 1분마다 갱신한다. */
function skyWindows(ctx: Context, frame: 'lobby-window' | 'meeting-window') {
  const { scene } = ctx
  const views = [150, 650].map(x => ({
    sky: scene.add.image(x, 32, 'sky-noon').setScale(2).setDepth(60.5),
    beam: (scene.add.image(x, 32, frame).setScale(2).setDepth(61), ctx.glow(x, 110, '#ffffff', 3, 4, 0.18, -40)),
  }))
  const apply = () => {
    const phase = skyPhase(new Date())
    const palette = SKY_PALETTES[phase]
    for (const { sky, beam } of views) { sky.setTexture(`sky-${phase}`); beam.setTint(hex(palette.light)).setAlpha(palette.lightAlpha) }
    return palette
  }
  const palette = apply()
  scene.time.addEvent({ delay: 60_000, loop: true, callback: apply })
  return palette
}

/** 실제 현재 시각을 가리키는 벽시계(초침 포함)와 디지털 표시 */
function wallClock(ctx: Context, x: number, frameColor: string, accent: string) {
  const { scene } = ctx
  scene.add.image(x, 28, 'clock-face').setScale(3).setDepth(61)
  const hands = scene.add.graphics().setDepth(62)
  const label = ctx.text(x, 56, '', 10, '#fff7e6', 62, true)
  const draw = () => {
    const now = new Date(), { hour, minute, second } = clockAngles(now)
    const at = (angle: number, length: number) => [x + Math.sin(angle) * length, 28 - Math.cos(angle) * length] as const
    hands.clear()
      .lineStyle(3, hex(frameColor)).lineBetween(x, 28, ...at(hour, 9))
      .lineStyle(2, hex(frameColor)).lineBetween(x, 28, ...at(minute, 14))
      .lineStyle(1, hex(accent)).lineBetween(x, 28, ...at(second, 15))
    label.setText(clockLabel(now))
  }
  draw()
  scene.time.addEvent({ delay: 1000, loop: true, callback: draw })
}

/** 화이트보드에 최근 안건 제목을 돌려 보여 준다. 20초마다, 그리고 이 브라우저에서 안건이 바뀌면 바로 다시 읽는다. */
function agendaBoard(ctx: Context) {
  const { scene } = ctx
  ctx.text(400, 74, '오늘의 안건', 10, '#64748b', 200)
  const title = ctx.text(400, 94, '불러오는 중…', 12, '#1e293b', 200).setFontStyle('bold')
  let titles: string[] = []
  let index = 0
  let controller: AbortController | undefined
  const load = () => {
    controller?.abort()
    controller = new AbortController()
    fetchAgendas(controller.signal, 5)
      .then(page => { titles = page.items.map(item => item.title); index = 0; title.setText(titles[0] ?? 'E로 안건 쓰기') })
      .catch(() => { if (!titles.length) title.setText('안건 없음') })
  }
  load()
  scene.time.addEvent({ delay: 20_000, loop: true, callback: load })
  ctx.every(6000, 6000, () => {
    if (titles.length < 2) return
    scene.tweens.add({ targets: title, alpha: 0, duration: 200, yoyo: true, onYoyo: () => title.setText(rotate(titles, ++index)) })
  })
  window.addEventListener(AGENDAS_CHANGED, load)
  return () => { controller?.abort(); window.removeEventListener(AGENDAS_CHANGED, load) }
}

const BOOK_COLORS = [0x8c2f39, 0x2f5d8c, 0x4f8c61, 0xc9a24b, 0x6b4f8c]
const PROP_DEPTH = 223 // 안내 데스크(기준선 222) 바로 위
const EMOTE_DEPTH = 1000

/**
 * 로비 생활 소품: 데스크 위 케이크와 커피 머신, 책장에서 꺼내는 책.
 * 먹고 마신 횟수는 이 브라우저에만(localStorage) 하루 단위로 남기며 서버와 동기화하지 않는다.
 */
function treatTable(ctx: Context) {
  const { scene } = ctx
  const props = {
    cake: scene.add.image(355, 172, 'cake-stand').setOrigin(0.5, 1).setScale(2).setDepth(PROP_DEPTH),
    coffee: scene.add.image(445, 172, 'coffee-machine').setOrigin(0.5, 1).setScale(2).setDepth(PROP_DEPTH),
  }
  // 커피 머신 위로 늘 김이 조금씩 오른다.
  scene.add.particles(445, 134, 'dot', {
    speedY: { min: -16, max: -8 }, speedX: { min: -3, max: 3 }, lifespan: 1300, frequency: 520,
    scale: { start: 1, end: 2 }, alpha: { start: 0.35, end: 0 },
  }).setDepth(PROP_DEPTH + 1)
  const burst = scene.add.particles(0, 0, 'dot', {
    emitting: false, lifespan: 900, speed: { min: 20, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 60,
    scale: { start: 1.5, end: 0 }, alpha: { start: 0.9, end: 0 },
  }).setDepth(EMOTE_DEPTH)
  const storage = (): Storage | undefined => { try { return globalThis.localStorage } catch { return undefined } }
  const where = (fallback: { x: number; y: number }) => ctx.options.player?.() ?? fallback
  let busyUntil = 0

  /**
   * 회원은 동전으로 산다(케이크 3원 HP +10, 커피 2원 피로도 +5). 비회원은 예전처럼 무료로 즐기기만 한다.
   * 동전이 모자라거나 이미 가득이면 먹지 않고 안내만 한다.
   */
  const buy = (kind: TreatKind) => {
    if (scene.time.now < busyUntil) return
    busyUntil = scene.time.now + 900
    const snack = kind === 'coffee' ? SNACKS.COFFEE : SNACKS.CAKE
    void inventoryStore.buySnack(kind === 'coffee' ? 'COFFEE' : 'CAKE').then(result => {
      // 응답 전에 방을 나가 소품이 정리됐으면 아무것도 하지 않는다.
      if (!props[kind].active) return
      if (result === 'broke') { playSfx('error', { volume: 0.5 }); ctx.banner.show(`동전이 부족해요 · ${snack.name} ${snack.price}원`, '#e05a6c', 1800); return }
      if (result === 'full') { ctx.banner.show(kind === 'coffee' ? '피로도가 가득해요 · 지금은 괜찮아요' : 'HP가 가득해요 · 배불러요', '#a7d98a', 1800); return }
      enjoy(kind, result === 'bought' ? `${snack.name} ${snack.price}원` : undefined)
    })
  }

  const enjoy = (kind: TreatKind, paid?: string) => {
    playSfx(kind === 'coffee' ? 'sip' : 'munch', { volume: 0.7 })
    const prop = props[kind]
    const me = where({ x: prop.x, y: prop.y + 60 })
    scene.tweens.add({ targets: prop, scaleY: 1.8, duration: 90, yoyo: true })
    const emote = scene.add.image(me.x, me.y - 46, `emote-${kind}`).setScale(2).setDepth(EMOTE_DEPTH)
    scene.tweens.add({ targets: emote, y: me.y - 62, duration: 1100, ease: 'Sine.easeOut' })
    scene.tweens.add({ targets: emote, alpha: 0, delay: 800, duration: 300, onComplete: () => emote.destroy() })
    if (kind === 'coffee') burst.setParticleTint(0xf4efe6).explode(10, me.x, me.y - 50)
    else burst.setParticleTint(0xf6e7c8).explode(12, me.x, me.y - 30)
    let count = 1
    try {
      const store = storage()
      const log = countTreat(store?.getItem(TREAT_STORAGE_KEY) ?? null, kind, localDay(new Date()))
      store?.setItem(TREAT_STORAGE_KEY, JSON.stringify(log))
      count = log[kind]
    } catch { /* 저장이 막혀도 연출은 계속한다 */ }
    ctx.banner.show(paid ? `${treatMessage(kind, count)} · ${paid}` : treatMessage(kind, count), kind === 'coffee' ? '#c9a24b' : '#e05a6c', 1800)
  }

  /** 책장에서 책 한 권이 내 캐릭터 쪽으로 포물선을 그리며 날아온다. */
  const pullBook = (shelf: RoomInteraction) => {
    const me = where({ x: shelf.x, y: shelf.y + 60 })
    playSfx('page', { volume: 0.6 })
    const book = scene.add.image(shelf.x, shelf.y - 10, 'book').setScale(2).setDepth(EMOTE_DEPTH)
      .setTint(BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]!)
    const from = { x: book.x, y: book.y }
    scene.tweens.addCounter({ from: 0, to: 1, duration: 420, ease: 'Sine.easeInOut',
      onUpdate: tween => {
        const t = tween.getValue() ?? 0
        book.setPosition(from.x + (me.x - from.x) * t, from.y + (me.y - 40 - from.y) * t - Math.sin(t * Math.PI) * 30).setAngle(t * 360)
      },
      onComplete: () => scene.tweens.add({ targets: book, alpha: 0, scale: 3, duration: 200, onComplete: () => book.destroy() }) })
  }
  return { buy, pullBook }
}

/** 개인 사무실: 방 테마 색의 책상 조명과 벽시계(세부 연출은 추후) */
function officeFx(ctx: Context): RoomHandlers {
  const lamp = ctx.glow(400, 230, ROOM_THEMES[ctx.options.room ?? 'office-1'].light, 7, 4, 0.22, -30)
  ctx.scene.tweens.add({ targets: lamp, alpha: 0.14, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  wallClock(ctx, 640, '#5f3d24', '#8c2f39')
  return { destroy: () => ctx.stop() }
}

/** 오락실(로비 왼쪽 아래): 벽의 네온 간판, 오락기마다 번갈아 깜빡이는 네온 빛, 가끔 터지는 반짝이 */
function arcadeFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  scene.add.rectangle(400, 32, 220, 34, 0x05020a, 0.9).setStrokeStyle(2, 0xf472b6).setDepth(61)
  const sign = ctx.text(400, 32, '★ SEULGAE ARCADE ★', 13, '#ffd23f', 62, true)
  scene.tweens.add({ targets: sign, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Stepped' })
  const colors = ['#f472b6', '#38bdf8', '#a78bfa', '#4ade80']
  const glows = [[130, 200], [210, 200], [590, 200], [670, 200], [400, 200], [160, 430], [640, 430]].map(([x, y], i) => ctx.glow(x!, y!, colors[i % colors.length]!, 3.5, 5, 0.25, 820))
  ctx.every(300, 300, () => { for (const glow of glows) if (Math.random() < 0.35) glow.setAlpha(glow.alpha > 0.2 ? 0.08 : 0.3) })
  const sparkle = scene.add.particles(0, 0, 'spark', { emitting: false, lifespan: 700, speed: { min: 40, max: 120 }, scale: { start: 2, end: 0 }, tint: [0xf472b6, 0x38bdf8, 0xffd23f] }).setDepth(950)
  ctx.every(6000, 11000, () => sparkle.explode(14, 400, 180))
  return { destroy: () => ctx.stop() }
}
