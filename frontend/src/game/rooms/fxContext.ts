import Phaser from 'phaser'
import type { RoomId } from '../maps/rooms'
import type MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import { MONO_FONT, UI_FONT, crispText } from '../render/renderScale'
import { nextDelay } from './roomEventLogic'

/** 방 연출 모듈(RoomFx와 방별 연출 파일)이 함께 쓰는 공통 도구 */
export type Options = {
  /** 이 연출이 그리는 방(공용 연출이 방 테마를 고를 때 쓴다) */
  openRecruitment?: (agent: string) => void
  room?: RoomId
  from?: RoomId; client: MultiplayerClient; plants?: Map<string, Phaser.GameObjects.Image>
  /** 먹고 마시기·책 꺼내기 연출이 따라갈 내 캐릭터 위치 */
  player?: () => { x: number; y: number } | undefined
}
export const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color
export const BANNER_DEPTH = 1100
export const DIM_DEPTH = 900

/** 방 연출 공통 도구: 반복 일정, 조명, 배너 */
export class Context {
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
export class Banner {
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
