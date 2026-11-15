import Phaser from 'phaser'
import type { PlayerState } from '../../features/multiplayer/model/protocol'

/**
 * 서버 상태를 보간하는 원격 캐릭터이며 로컬 충돌 계산에는 참여하지 않는다.
 *
 * @author seulgae
 * @version 1.0, 원격 위치·방향·애니메이션 및 이름표 표시
 * @see "None"
 */
export default class RemotePlayer extends Phaser.GameObjects.Sprite {
  private target: PlayerState
  private readonly nameLabel: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, state: PlayerState) {
    super(scene, state.x, state.y, 'researcher', 16)
    this.target = state
    scene.add.existing(this)
    this.setOrigin(0.5, 1).setScale(2).setTint(0xc4dce8)
    this.nameLabel = scene.add.text(state.x, state.y - 55, state.nickname, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#edf3ff', backgroundColor: '#20383a', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setResolution(2)
  }

  setTarget(state: PlayerState) { this.target = state }

  update(delta: number) {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y)
    const alpha = distance > 120 ? 1 : Math.min(1, delta / 80)
    this.setPosition(Phaser.Math.Linear(this.x, this.target.x, alpha), Phaser.Math.Linear(this.y, this.target.y, alpha))
    this.setDepth(this.y)
    this.play(`${this.target.moving || distance > 1.5 ? 'walk' : 'idle'}-${this.target.facing}`, true)
    this.nameLabel.setPosition(this.x, this.y - 55).setDepth(900)
  }

  override destroy(fromScene?: boolean) {
    this.nameLabel.destroy()
    super.destroy(fromScene)
  }
}
