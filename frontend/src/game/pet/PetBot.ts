import type Phaser from 'phaser'
import type { RoomId } from '../maps/rooms'
import { UI_FONT, crispText } from '../render/renderScale.ts'
import { follow, nextTip, petTarget } from './petTips.ts'

/** 방에 들어온 뒤 첫 팁까지, 팁 사이 간격, 말풍선이 떠 있는 시간(ms) */
export const PET_FIRST_TIP_MS = 1400
export const PET_TIP_GAP_MS = [22000, 34000] as const
export const PET_TIP_SHOW_MS = 4200
/** 내 화면에만 보이는 펫(다른 연구원에게는 보이지 않는다) */
const DEPTH_OFFSET = 2

/**
 * 캐릭터 곁을 둥둥 따라다니는 미니 로봇 펫. 방마다 할 수 있는 일을 짧은 말풍선으로 툭툭 알려 준다(튜토리얼).
 * 펫을 누르면 바로 다른 팁을 말한다. 서버와 상관없는 화면 연출이다.
 *
 * @author seulgae
 * @version 1.0, 튜토리얼 미니 로봇 펫
 * @see "None"
 */
export default class PetBot {
  private readonly scene: Phaser.Scene
  private readonly roomId: RoomId
  private readonly sprite: Phaser.GameObjects.Image
  private readonly jet: Phaser.GameObjects.Rectangle
  private readonly bubble: Phaser.GameObjects.Container
  private readonly bubbleText: Phaser.GameObjects.Text
  private readonly bubbleBox: Phaser.GameObjects.Graphics
  private readonly seen: string[] = []
  private x: number
  private y: number
  private facingRight = true
  private lastPlayerX: number
  private age = 0
  private nextTipAt = PET_FIRST_TIP_MS
  private hideAt = 0
  private nextBlinkAt = 2500
  private blinkUntil = 0
  /** 말풍선을 그릴 때의 방향(꼬리 위치) */
  private bubbleSide = true
  private welcomePending: boolean
  private readonly automaticTips: boolean

  constructor(scene: Phaser.Scene, roomId: RoomId, player: { x: number; y: number },
    options: { approachFrom?: { x: number; y: number }; automaticTips?: boolean } = {}) {
    this.scene = scene; this.roomId = roomId
    this.welcomePending = options.approachFrom !== undefined
    this.automaticTips = options.automaticTips ?? true
    const start = options.approachFrom ?? petTarget(player, true)
    this.x = start.x; this.y = start.y; this.lastPlayerX = player.x
    this.jet = scene.add.rectangle(this.x, this.y + 16, 6, 4, 0xffd23f, 0.9)
    this.sprite = scene.add.image(this.x, this.y, 'pet-robot').setScale(2)
    this.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.say())
    this.bubbleBox = scene.add.graphics()
    this.bubbleText = crispText(scene, 0, 0, '', { fontFamily: UI_FONT, fontSize: '13px', fontStyle: 'bold', color: '#12343b', padding: { x: 8, y: 5 } })
    this.bubble = scene.add.container(0, 0, [this.bubbleBox, this.bubbleText]).setDepth(1150).setVisible(false)
  }

  /** 지금 방 팁 하나를 말풍선으로 띄운다. */
  say(tip = nextTip(this.roomId, this.seen)) {
    this.seen.push(tip)
    this.bubbleText.setText(tip)
    this.drawBubble()
    this.bubble.setVisible(true).setAlpha(1)
    this.hideAt = this.age + PET_TIP_SHOW_MS
    this.nextTipAt = this.age + PET_TIP_GAP_MS[0] + Math.random() * (PET_TIP_GAP_MS[1] - PET_TIP_GAP_MS[0])
    // 말할 때 살짝 뛰어오른다.
    this.scene.tweens.add({ targets: this.sprite, scaleY: 2.25, duration: 90, yoyo: true })
    return tip
  }

  update(player: { x: number; y: number }, deltaMs: number) {
    this.age += deltaMs
    // 캐릭터가 움직인 방향을 바라보고, 그 반대쪽 뒤로 따라간다.
    if (Math.abs(player.x - this.lastPlayerX) > 0.5) this.facingRight = player.x > this.lastPlayerX
    this.lastPlayerX = player.x
    const target = petTarget(player, this.facingRight)
    this.x = follow(this.x, target.x, deltaMs)
    this.y = follow(this.y, target.y, deltaMs)
    const bob = Math.sin(this.age / 320) * 3
    const drawY = Math.round(this.y + bob)
    this.sprite.setPosition(Math.round(this.x), drawY).setFlipX(!this.facingRight).setDepth(player.y + DEPTH_OFFSET)
    this.jet.setPosition(Math.round(this.x), drawY + 17).setDepth(player.y + DEPTH_OFFSET - 1)
      .setAlpha(0.55 + Math.abs(Math.sin(this.age / 70)) * 0.4)
    // 가끔 눈을 깜박인다.
    if (this.age >= this.nextBlinkAt) {
      this.sprite.setTexture('pet-robot-blink')
      this.blinkUntil = this.age + 140
      this.nextBlinkAt = this.age + 2600 + Math.random() * 2400
    } else if (this.blinkUntil && this.age >= this.blinkUntil) { this.sprite.setTexture('pet-robot'); this.blinkUntil = 0 }
    if (this.welcomePending && Math.hypot(this.x - target.x, this.y - target.y) < 14) {
      this.welcomePending = false
      this.say('첫 출근을 축하해요! 연구소까지 함께 가요.')
    } else if (!this.welcomePending && this.automaticTips && this.age >= this.nextTipAt) this.say()
    if (this.bubble.visible) {
      // 펫이 반대쪽으로 넘어가면 꼬리도 다시 그린다.
      if (this.bubbleSide !== this.facingRight) this.drawBubble()
      const remaining = this.hideAt - this.age
      // 말풍선은 캐릭터 반대쪽(바깥)으로 펼쳐 캐릭터 이름표와 겹치지 않게 한다.
      const width = this.bubbleText.width
      const left = this.facingRight ? this.x + 14 - width : this.x - 14
      this.bubble.setPosition(Math.round(left), Math.round(drawY - 24 - this.bubbleText.height))
        .setAlpha(Math.max(0, Math.min(1, remaining / 400)))
      if (remaining <= 0) this.bubble.setVisible(false)
    }
  }

  /** 말풍선 상자와 꼬리를 그린다. 꼬리는 펫 머리 위(말풍선이 바깥으로 펼쳐지므로 안쪽 끝 근처)에 둔다. */
  private drawBubble() {
    const width = this.bubbleText.width, height = this.bubbleText.height
    const tail = this.facingRight ? width - 14 : 14
    this.bubbleSide = this.facingRight
    this.bubbleBox.clear().fillStyle(0xeafffb).fillRect(0, 0, width, height).lineStyle(2, 0x2bb3a0).strokeRect(0, 0, width, height)
      .fillStyle(0xeafffb).fillTriangle(tail - 5, height, tail + 5, height, tail, height + 6)
  }

  /** 지금 말풍선에 떠 있는 팁(없으면 빈 문자열) */
  currentTip() { return this.bubble.visible ? this.bubbleText.text : '' }

  destroy() { this.sprite.destroy(); this.jet.destroy(); this.bubble.destroy() }
}
