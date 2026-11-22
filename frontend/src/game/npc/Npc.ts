import type Phaser from 'phaser'
import type { RoomInteraction } from '../maps/rooms'
import SpeechBubble from './SpeechBubble.ts'
import { pickLine, stepToward } from './npcData.ts'
import type { NpcDef } from './npcData.ts'

const TALK_MS = 3800
const MUTTER_GAP: readonly [number, number] = [11000, 19000]

/**
 * 정해진 길을 오가는 NPC 하나. 걸을 때는 두 프레임을 번갈아 쓰고, E로 말을 걸면 멈춰서 한마디 한다.
 * 중얼거리는 말(mutter)이 있으면 가끔 혼자 말풍선을 띄운다.
 *
 * @author seulgae
 * @version 1.2, 사무실 직원의 앉기·일어서기와 지정 대사 지원
 * @see "None"
 */
export default class Npc {
  readonly def: NpcDef
  private readonly scene: Phaser.Scene
  private readonly sprite: Phaser.GameObjects.Image
  private readonly bubble: SpeechBubble
  private x: number
  private y: number
  private next = 1
  private restUntil = 0
  private age = 0
  private frame = 0
  private frameAt = 0
  private lastLine: string | undefined
  private nextMutterAt: number
  /** 놀람·웃음 표정을 보여 주는 동안(이때는 걷기 프레임으로 바꾸지 않는다) */
  private expressionUntil = 0
  private workState: string | undefined
  private seated: boolean

  constructor(scene: Phaser.Scene, def: NpcDef) {
    this.def = def
    this.seated = def.seated ?? false
    this.scene = scene
    // 처음 자리는 경로 중 한 곳(매번 조금 다르게)
    const start = def.fixed ? 0 : Math.floor(Math.random() * def.path.length)
    this.x = def.path[start]!.x; this.y = def.path[start]!.y
    this.next = (start + 1) % def.path.length
    this.sprite = scene.add.image(this.x, this.y - (def.seated ? 14 : 0), `npc-${def.kind}-${def.seated ? 'seated-' : ''}0`).setOrigin(0.5, 1).setScale(2).setDepth(this.y)
    this.bubble = new SpeechBubble(scene, def.mutter ? { fill: 0xfff4e0, line: 0xc98a4b, text: '#5a3a2a' } : { fill: 0xf4fff0, line: 0x4f8c61, text: '#24402a' })
    this.nextMutterAt = 4000 + Math.random() * 6000
    if (def.facesRight !== undefined) this.sprite.setFlipX(!def.facesRight)
  }

  /** 신규 업무 NPC의 클릭을 기존 픽셀 스프라이트에 연결한다. */
  onClick(open: () => void) { this.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', open) }

  /** 실제 서버 상태만 색과 작업 프레임에 반영한다. */
  setWorkState(state: string) {
    this.workState = state
    this.sprite.setTint(state === 'FAILED' ? 0xff9999 : state === 'COMPLETED' ? 0xaaffbb : state === 'WORKING' ? 0xffee99 : 0xffffff)
  }

  /** 정해진 작업석에서 일어나거나 앉을 때만 자세와 기준 위치를 바꾼다. */
  setSeated(seated: boolean, position = this.def.path[0]!) {
    this.seated = seated; this.x = position.x; this.y = position.y
    this.frame = 0; this.restUntil = this.age + 600000
  }

  /** 대사 연출을 표시하며 대화가 끝날 때까지 이동을 멈춘다. */
  say(text: string, durationMs = TALK_MS) {
    this.lastLine = text; this.bubble.show(text, this.age, durationMs); this.restUntil = this.age + durationMs
  }

  get position() { return { x: this.x, y: this.y } }

  /** E로 말 걸 수 있는 영역(장면의 상호작용 대상) */
  target(): RoomInteraction {
    if (this.seated) return { id: this.def.id, kind: 'npc', label: this.def.id.startsWith('recruitment-') ? `${this.def.name} · 공고 보기` : `${this.def.name}에게 말 걸기`, x: this.x, y: this.y - 12, width: 28, height: 24, range: 40 }
    return { id: this.def.id, kind: 'npc', label: `${this.def.name}에게 말 걸기`, x: this.x, y: this.y - 20, width: 24, height: 40, range: this.def.fixed ? 22 : 30 }
  }

  /** 말을 건다: 멈춰서 상대를 보고 한마디 */
  talk(player?: { x: number }) {
    this.lastLine = pickLine(this.def.talk, this.lastLine)
    this.bubble.show(this.lastLine, this.age, TALK_MS)
    this.restUntil = this.age + TALK_MS
    if (player) this.sprite.setFlipX(player.x < this.x)
    return this.lastLine
  }

  /**
   * 빌드 결과에 반응한다: 실패하면 "!!"와 함께 펄쩍 놀라고, 성공하면 "♪"와 함께 웃으며 깡충 뛴다.
   * @returns 한 말(반응이 없는 NPC면 빈 문자열)
   */
  react(passed: boolean) {
    const lines = passed ? this.def.reactions?.pass : this.def.reactions?.fail
    if (!lines) return ''
    this.lastLine = pickLine(lines, this.lastLine)
    this.bubble.show(this.lastLine, this.age, TALK_MS)
    this.restUntil = this.age + TALK_MS
    if (this.def.kind === 'professor') this.sprite.setTexture(passed ? 'npc-professor-happy' : 'npc-professor-shock')
    this.expressionUntil = this.age + 1800
    const emote = this.scene.add.text(Math.round(this.x), Math.round(this.y - 62), passed ? '♪' : '!!', {
      fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: passed ? '#39e6b4' : '#f87171', stroke: '#0a0f19', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1150)
    this.scene.tweens.add({ targets: emote, y: emote.y - 18, alpha: 0, delay: 600, duration: 900, onComplete: () => emote.destroy() })
    this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - (passed ? 8 : 14), duration: passed ? 160 : 110, yoyo: true, repeat: passed ? 2 : 0, ease: 'Sine.easeOut' })
    return this.lastLine
  }

  update(deltaMs: number) {
    this.age += deltaMs
    if (this.age >= this.restUntil) {
      const goal = this.def.path[this.next]!
      const moved = stepToward({ x: this.x, y: this.y }, goal, this.def.speed, deltaMs)
      if (Math.abs(moved.x - this.x) > 0.01) this.sprite.setFlipX(moved.x < this.x)
      else if (this.def.facesRight !== undefined) this.sprite.setFlipX(!this.def.facesRight)
      this.x = moved.x; this.y = moved.y
      if (moved.arrived) {
        this.next = (this.next + 1) % this.def.path.length
        const [min, max] = this.def.pause
        this.restUntil = this.age + min + Math.random() * (max - min)
      }
      // 걸을 때 두 프레임을 번갈아(살짝 통통 튀게)
      if (this.age - this.frameAt > 220) { this.frame = 1 - this.frame; this.frameAt = this.age }
    } else if (this.def.idle) {
      // 제자리에서도 천천히 두 프레임을 번갈아(낚싯대 까딱)
      if (this.age - this.frameAt > 900) { this.frame = 1 - this.frame; this.frameAt = this.age }
    } else this.frame = 0
    if (this.workState === 'WORKING') this.frame = Math.floor(this.age / 260) % 2
    if (this.age >= this.expressionUntil) this.sprite.setTexture(`npc-${this.def.kind}-${this.seated ? 'seated-' : ''}${this.frame}`)
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - (this.seated ? 14 : this.frame && !this.def.idle ? 1 : 0))).setDepth(this.y + (this.seated ? 1 : 0))
    if (this.def.mutter && this.age >= this.nextMutterAt && !this.bubble.visible) {
      this.lastLine = pickLine(this.def.mutter, this.lastLine)
      this.bubble.show(this.lastLine, this.age, 3200)
      this.nextMutterAt = this.age + MUTTER_GAP[0] + Math.random() * (MUTTER_GAP[1] - MUTTER_GAP[0])
    }
    this.bubble.update(this.x, this.y - (this.def.kind.startsWith('kid') ? 38 : 50), this.age)
  }

  destroy() { this.sprite.destroy(); this.bubble.destroy() }
}
