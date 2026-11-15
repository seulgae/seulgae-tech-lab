import Phaser from 'phaser'

export default class Player extends Phaser.GameObjects.Rectangle {
  declare body: Phaser.Physics.Arcade.Body

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
    scene.physics.add.existing(this)
    this.body.setCollideWorldBounds(true)

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

  update(movementEnabled = true) {
    if (!movementEnabled) {
      this.body.setVelocity(0, 0)
      return
    }

    const left = this.cursors.left.isDown || this.wasd.left.isDown
    const right = this.cursors.right.isDown || this.wasd.right.isDown
    const up = this.cursors.up.isDown || this.wasd.up.isDown
    const down = this.cursors.down.isDown || this.wasd.down.isDown

    // 속도(px/초)만 전달하고 시간 적용과 충돌 후 좌표 계산은 Arcade Physics에 맡긴다.
    this.direction.set(Number(right) - Number(left), Number(down) - Number(up))
    this.direction.normalize().scale(this.speed)
    this.body.setVelocity(this.direction.x, this.direction.y)
  }
}
