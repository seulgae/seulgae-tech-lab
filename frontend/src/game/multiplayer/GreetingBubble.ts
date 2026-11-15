import Phaser from 'phaser'

/**
 * 서버에서 승인된 고정 인사를 3초 동안 캐릭터 위에 표시한다.
 *
 * @author seulgae
 * @version 1.0, 장면 갱신 기반 말풍선 표시와 자원 정리
 * @see "None"
 */
export default class GreetingBubble {
  private readonly label: Phaser.GameObjects.Text
  private readonly expiresAt: number

  constructor(scene: Phaser.Scene, message: string, durationMs: number) {
    this.expiresAt = Date.now() + durationMs
    this.label = scene.add.text(0, 0, message, {
      fontFamily: 'Arial, "Segoe UI Emoji", sans-serif', fontSize: '16px', color: '#243f43',
      backgroundColor: '#fff2d2', padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 1).setResolution(2).setDepth(1100)
  }

  /** @returns 유효 시간이 남아 있어 화면에 유지하면 true */
  update(x: number, y: number) {
    this.label.setPosition(Math.max(55, Math.min(745, x)), Math.max(35, y - 74))
    return Date.now() < this.expiresAt
  }

  destroy() { this.label.destroy() }
}
