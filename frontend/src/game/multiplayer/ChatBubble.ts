import Phaser from 'phaser'

/**
 * 일반 텍스트를 픽셀 테두리 말풍선으로 표시하고 같은 캐릭터의 새 메시지에 재사용한다.
 * @author seulgae
 * @version 1.0, 줄바꿈·카메라 경계·5초 표시와 마지막 페이드
 * @see "None"
 */
export default class ChatBubble {
  private readonly label: Phaser.GameObjects.Text
  private readonly border: Phaser.GameObjects.Graphics
  private readonly container: Phaser.GameObjects.Container
  private readonly scene: Phaser.Scene
  private expiresAt = 0

  constructor(scene: Phaser.Scene, message: string) {
    this.scene = scene
    this.border = scene.add.graphics()
    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'Arial, "Segoe UI Emoji", sans-serif', fontSize: '16px', color: '#243f43',
      padding: { x: 9, y: 7 }, wordWrap: { width: 220, useAdvancedWrap: true },
    }).setResolution(2)
    this.container = scene.add.container(0, 0, [this.border, this.label]).setDepth(1100)
    this.setMessage(message)
  }

  /** 같은 객체의 텍스트와 유효 시간만 갱신한다. HTML로 해석하지 않는다. */
  setMessage(message: string) {
    this.label.setText(message)
    const lines = this.label.getWrappedText()
    // 수십 개의 명시적 줄바꿈도 맵을 덮지 않게 한다. 전체 내용은 React 내역에 남는다.
    if (lines.length > 12) this.label.setText([...lines.slice(0, 11), '…'].join('\n'))
    this.border.clear().fillStyle(0xfff5df).fillRect(0, 0, this.label.width, this.label.height)
      .lineStyle(2, 0x425e55).strokeRect(0, 0, this.label.width, this.label.height)
    this.expiresAt = Date.now() + 5000
    this.container.setAlpha(1)
  }

  /** @returns 유효 시간이 남아 화면에 유지하면 true */
  update(x: number, y: number) {
    const view = this.scene.cameras.main.worldView
    const top = view.y + 6, left = view.x + 6
    const px = Math.max(left, Math.min(view.right - this.label.width - 6, x - this.label.width / 2))
    let py = y - 78 - this.label.height
    // 맵 위쪽에서 위 공간이 부족하면 이름표를 덮지 않도록 발밑 쪽에 배치한다.
    if (py < top) py = y + 12
    py = Math.max(top, Math.min(view.bottom - this.label.height - 6, py))
    this.container.setPosition(Math.round(px), Math.round(py))
    const remaining = this.expiresAt - Date.now()
    this.container.setAlpha(Math.max(0, Math.min(1, remaining / 400)))
    return remaining > 0
  }

  destroy() { this.container.destroy() }
}
