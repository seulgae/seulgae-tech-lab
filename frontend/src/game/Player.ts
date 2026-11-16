import Phaser from 'phaser'
import { createPlayerAnimations, getFacing } from './PlayerAnimation'
import type { Facing } from './PlayerAnimation'
import { PLAYER_FOOT } from './maps/lobbyLayout'
import { constrainedPosition, translateBody } from './multiplayer/networkPosition'
import { combineDirections } from './input/mobileInput'
import type { DirectionInput } from './input/mobileInput'
import SeatView from './seating'
import type { Seat } from './maps/rooms'

/**
 * 키보드·터치 이동과 발밑 물리 영역을 관리하는 연구원 캐릭터이다.
 *
 * @author seulgae
 * @version 1.0, 정규화된 키보드·터치 입력과 픽셀 캐릭터 애니메이션 연결
 * @see "None"
 */
export default class Player extends Phaser.GameObjects.Sprite {
  declare body: Phaser.Physics.Arcade.Body

  private readonly speed = 200 // 초당 이동 거리(px)
  private readonly direction = new Phaser.Math.Vector2()
  private facing: Facing = 'down'
  private movementInput = { x: 0, y: 0 }
  private readonly seatView: SeatView
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly wasd: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'researcher', 16)
    scene.add.existing(this)
    this.setOrigin(0.5, 1).setScale(2)
    scene.physics.add.existing(this)
    // 32×48 외형과 달리 발밑 20×16 영역만 충돌시켜 가구 뒤를 자연스럽게 지나간다.
    this.body.setSize(PLAYER_FOOT.halfWidth, PLAYER_FOOT.height / 2).setOffset(8 - PLAYER_FOOT.halfWidth / 2, 24 - PLAYER_FOOT.height / 2)
    this.body.setCollideWorldBounds(true)
    createPlayerAnimations(scene)
    this.play('idle-down')
    this.seatView = new SeatView(scene)

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

  /**
   * 키보드와 터치 방향을 합쳐 일정 속도로 이동하고 충돌 상태에 맞게 애니메이션을 갱신한다.
   * @param movementEnabled 패널·채팅 입력 중 이동 허용 여부
   * @param touch 조이스틱의 정수 방향
   */
  update(movementEnabled = true, touch: DirectionInput = { x: 0, y: 0 }) {
    this.setDepth(this.y)
    if (!movementEnabled) {
      this.movementInput = { x: 0, y: 0 }
      this.body.setVelocity(0, 0)
      this.play(`idle-${this.facing}`, true)
      return
    }

    this.movementInput = combineDirections({
      x: Number(this.cursors.right.isDown || this.wasd.right.isDown) - Number(this.cursors.left.isDown || this.wasd.left.isDown),
      y: Number(this.cursors.down.isDown || this.wasd.down.isDown) - Number(this.cursors.up.isDown || this.wasd.up.isDown),
    }, touch)
    // 이동 입력이 들어오면 자리에서 일어난다. 서버도 이동 명령을 처리하며 자리를 비운다.
    if (this.seatView.seat && (this.movementInput.x || this.movementInput.y)) this.sit(undefined)
    const left = this.movementInput.x < 0, right = this.movementInput.x > 0
    const up = this.movementInput.y < 0, down = this.movementInput.y > 0

    // 속도(px/초)만 전달하고 시간 적용과 충돌 후 좌표 계산은 Arcade Physics에 맡긴다.
    this.direction.set(this.movementInput.x, this.movementInput.y)
    this.direction.normalize().scale(this.speed)
    this.body.setVelocity(this.direction.x, this.direction.y)
    this.facing = getFacing(this.direction.x, this.direction.y, this.facing)
    const { blocked, touching } = this.body
    const movingX = left && !blocked.left && !touching.left || right && !blocked.right && !touching.right
    const movingY = up && !blocked.up && !touching.up || down && !blocked.down && !touching.down
    const walking = this.direction.lengthSq() > 0 && (movingX || movingY)
    this.play(`${walking ? 'walk' : 'idle'}-${this.facing}`, true)
  }

  /** 좌표 대신 현재 정수 방향 입력만 네트워크 계층에 전달한다. */
  getInput() { return this.movementInput }

  /** 의자에 앉거나(seat) 일어난다(undefined). 앉은 동안 서 있는 스프라이트는 숨긴다. */
  sit(seat: Seat | undefined) {
    this.seatView.show(seat)
    this.setVisible(!seat)
  }

  get seat() { return this.seatView.seat }

  /** 이름표 위치: 앉았으면 의자 위 */
  labelAnchor() { return this.seatView.labelAnchor() ?? { x: this.x, y: this.y - 55 } }

  override destroy(fromScene?: boolean) {
    this.seatView?.destroy()
    super.destroy(fromScene)
  }

  /** 물리 프레임 완료 후에만 네트워크 보정을 적용하며 일반 보정은 장애물을 통과하지 않는다. */
  correctPosition(x: number, y: number, authoritative = false) {
    const target = authoritative ? { x, y } : constrainedPosition(this.x, this.y, x - this.x, y - this.y)
    const dx = target.x - this.x, dy = target.y - this.y
    translateBody(this, this.body, dx, dy)
    return { x: dx, y: dy }
  }
}
