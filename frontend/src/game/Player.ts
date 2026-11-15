import Phaser from 'phaser'

export default class Player extends Phaser.GameObjects.Rectangle {
  private readonly speed = 200 // 초당 이동 거리(px)
  private readonly direction = new Phaser.Math.Vector2()
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly wasd: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 24, 24, 0xff9800)
    scene.add.existing(this)

    const keyboard = scene.input.keyboard
    if (!keyboard) throw new Error('Player requires keyboard input')

    this.cursors = keyboard.createCursorKeys()
    this.wasd = {
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
    }
  }

  update(delta: number) {
    const left = this.cursors.left.isDown || this.wasd.left.isDown
    const right = this.cursors.right.isDown || this.wasd.right.isDown
    const up = this.cursors.up.isDown || this.wasd.up.isDown
    const down = this.cursors.down.isDown || this.wasd.down.isDown

    // 대각선 벡터도 길이 1로 맞춘 뒤, 밀리초를 초로 바꿔 이동한다.
    this.direction.set(Number(right) - Number(left), Number(down) - Number(up))
    this.direction.normalize().scale(this.speed * delta / 1000)

    const halfWidth = this.displayWidth / 2
    const halfHeight = this.displayHeight / 2
    this.x = Phaser.Math.Clamp(this.x + this.direction.x, halfWidth, this.scene.scale.width - halfWidth)
    this.y = Phaser.Math.Clamp(this.y + this.direction.y, halfHeight, this.scene.scale.height - halfHeight)
  }
}
