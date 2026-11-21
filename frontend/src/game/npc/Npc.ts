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
 * @version 1.0, 바깥 시민·청소 아주머니 NPC
 * @see "None"
 */
export default class Npc {
  readonly def: NpcDef
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

  constructor(scene: Phaser.Scene, def: NpcDef) {
    this.def = def
    // 처음 자리는 경로 중 한 곳(매번 조금 다르게)
    const start = Math.floor(Math.random() * def.path.length)
    this.x = def.path[start]!.x; this.y = def.path[start]!.y
    this.next = (start + 1) % def.path.length
    this.sprite = scene.add.image(this.x, this.y, `npc-${def.kind}-0`).setOrigin(0.5, 1).setScale(2).setDepth(this.y)
    this.bubble = new SpeechBubble(scene, def.mutter ? { fill: 0xfff4e0, line: 0xc98a4b, text: '#5a3a2a' } : { fill: 0xf4fff0, line: 0x4f8c61, text: '#24402a' })
    this.nextMutterAt = 4000 + Math.random() * 6000
  }

  get position() { return { x: this.x, y: this.y } }

  /** E로 말 걸 수 있는 영역(장면의 상호작용 대상) */
  target(): RoomInteraction {
    return { id: this.def.id, kind: 'npc', label: `${this.def.name}에게 말 걸기`, x: this.x, y: this.y - 20, width: 24, height: 40, range: 30 }
  }

  /** 말을 건다: 멈춰서 상대를 보고 한마디 */
  talk(player?: { x: number }) {
    this.lastLine = pickLine(this.def.talk, this.lastLine)
    this.bubble.show(this.lastLine, this.age, TALK_MS)
    this.restUntil = this.age + TALK_MS
    if (player) this.sprite.setFlipX(player.x < this.x)
    return this.lastLine
  }

  update(deltaMs: number) {
    this.age += deltaMs
    if (this.age >= this.restUntil) {
      const goal = this.def.path[this.next]!
      const moved = stepToward({ x: this.x, y: this.y }, goal, this.def.speed, deltaMs)
      if (Math.abs(moved.x - this.x) > 0.01) this.sprite.setFlipX(moved.x < this.x)
      this.x = moved.x; this.y = moved.y
      if (moved.arrived) {
        this.next = (this.next + 1) % this.def.path.length
        const [min, max] = this.def.pause
        this.restUntil = this.age + min + Math.random() * (max - min)
      }
      // 걸을 때 두 프레임을 번갈아(살짝 통통 튀게)
      if (this.age - this.frameAt > 220) { this.frame = 1 - this.frame; this.frameAt = this.age }
    } else this.frame = 0
    this.sprite.setTexture(`npc-${this.def.kind}-${this.frame}`).setPosition(Math.round(this.x), Math.round(this.y - (this.frame ? 1 : 0))).setDepth(this.y)
    if (this.def.mutter && this.age >= this.nextMutterAt && !this.bubble.visible) {
      this.lastLine = pickLine(this.def.mutter, this.lastLine)
      this.bubble.show(this.lastLine, this.age, 3200)
      this.nextMutterAt = this.age + MUTTER_GAP[0] + Math.random() * (MUTTER_GAP[1] - MUTTER_GAP[0])
    }
    this.bubble.update(this.x, this.y - 50, this.age)
  }

  destroy() { this.sprite.destroy(); this.bubble.destroy() }
}
