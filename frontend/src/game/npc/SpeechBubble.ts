import type Phaser from 'phaser'
import { UI_FONT, crispText } from '../render/renderScale.ts'

/**
 * NPC 머리 위 말풍선. 정해진 시간 뒤 서서히 사라진다.
 *
 * @author seulgae
 * @version 1.1, 이동 직원의 말풍선을 화면 안쪽으로 보정
 * @see "None"
 */
export default class SpeechBubble {
  private readonly box: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private readonly container: Phaser.GameObjects.Container
  private readonly colors: { fill: number; line: number; text: string }
  private hideAt = 0

  constructor(scene: Phaser.Scene, colors: { fill: number; line: number; text: string }) {
    this.colors = colors
    this.box = scene.add.graphics()
    this.label = crispText(scene, 0, 0, '', { fontFamily: UI_FONT, fontSize: '13px', color: colors.text, padding: { x: 8, y: 5 }, wordWrap: { width: 200, useAdvancedWrap: true } })
    this.container = scene.add.container(0, 0, [this.box, this.label]).setDepth(1140).setVisible(false)
  }

  show(text: string, now: number, durationMs: number) {
    this.label.setText(text)
    const width = this.label.width, height = this.label.height
    this.box.clear().fillStyle(this.colors.fill).fillRect(0, 0, width, height).lineStyle(2, this.colors.line).strokeRect(0, 0, width, height)
      .fillStyle(this.colors.fill).fillTriangle(width / 2 - 5, height, width / 2 + 5, height, width / 2, height + 6)
    this.container.setVisible(true).setAlpha(1)
    this.hideAt = now + durationMs
  }

  /** 말하는 사람 머리 위(x, top)에 붙인다. */
  update(x: number, top: number, now: number) {
    if (!this.container.visible) return
    const remaining = this.hideAt - now
    this.container.setPosition(Math.round(Math.max(8, Math.min(x - this.label.width / 2, 792 - this.label.width))), Math.round(Math.max(70, top - 10 - this.label.height))).setAlpha(Math.max(0, Math.min(1, remaining / 400)))
    if (remaining <= 0) this.container.setVisible(false)
  }

  get visible() { return this.container.visible }
  get text() { return this.label.text }

  destroy() { this.container.destroy() }
}
