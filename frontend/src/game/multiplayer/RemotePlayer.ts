import Phaser from 'phaser'
import type { PlayerState } from '../../features/multiplayer/model/protocol'
import RemoteInterpolation from './RemoteInterpolation'
import { crispText } from '../render/renderScale.ts'

/**
 * 서버 상태를 보간하는 원격 캐릭터이며 로컬 충돌 계산에는 참여하지 않는다.
 *
 * @author seulgae
 * @version 1.0, 서버 시간 버퍼 보간·방향·애니메이션 및 이름표 표시
 * @see "None"
 */
export default class RemotePlayer extends Phaser.GameObjects.Sprite {
  private readonly timeline = new RemoteInterpolation()
  private readonly nameLabel: Phaser.GameObjects.Text
  private readonly debug = new URLSearchParams(window.location.search).get('netDebug') === '1'
  private elapsed = 0
  private frames = 0
  private movingFrames = 0
  private stalledFrames = 0
  private speedSum = 0
  private squaredSpeedSum = 0

  constructor(scene: Phaser.Scene, state: PlayerState, serverTime = performance.now()) {
    super(scene, state.x, state.y, 'researcher', 16)
    this.timeline.push(state, serverTime, performance.now())
    scene.add.existing(this)
    this.setOrigin(0.5, 1).setScale(2).setTint(0xc4dce8)
    this.nameLabel = crispText(scene, state.x, state.y - 55, state.nickname, {
      fontSize: '15px', fontStyle: 'bold', color: '#edf3ff', backgroundColor: '#14202acc', padding: { x: 5, y: 2 },
    }).setOrigin(0.5)
  }

  setTarget(state: PlayerState, serverTime = performance.now()) { this.timeline.push(state, serverTime, performance.now()) }

  update(delta: number) {
    const target = this.timeline.sample(performance.now(), delta)
    const dx = target.x - this.x, dy = target.y - this.y, distance = Math.hypot(dx, dy)
    // 큰 몰림도 순간 이동시키지 않고, 알려진 목표까지 제한된 속도로 따라간다.
    const amount = Math.min(distance, 260 * Math.max(0, Math.min(100, delta)) / 1000)
    const scale = distance > 0 ? amount / distance : 0
    this.setPosition(this.x + dx * scale, this.y + dy * scale)
    this.setDepth(this.y)
    this.play(`${amount > 0.02 ? 'walk' : 'idle'}-${target.facing}`, true)
    this.nameLabel.setPosition(this.x, this.y - 55).setDepth(900)
    if (this.debug) {
      this.elapsed += delta; this.frames++
      if (target.moving && delta > 0) {
        const speed = amount * 1000 / delta
        this.movingFrames++; this.speedSum += speed; this.squaredSpeedSum += speed * speed
        if (amount < 0.02) this.stalledFrames++
      }
      if (this.elapsed >= 5000) {
        const mean = this.movingFrames ? this.speedSum / this.movingFrames : 0
        console.info('[multiplayer:remote]', JSON.stringify({ fps: Math.round(this.frames * 1000 / this.elapsed),
          movingFrames: this.movingFrames, stalledFrames: this.stalledFrames,
          speedStdDev: Math.round(Math.sqrt(Math.max(0, this.movingFrames ? this.squaredSpeedSum / this.movingFrames - mean * mean : 0)) * 10) / 10,
          bufferMs: Math.round(this.timeline.bufferMs) }))
        this.elapsed = 0; this.frames = 0; this.movingFrames = 0; this.stalledFrames = 0; this.speedSum = 0; this.squaredSpeedSum = 0
      }
    }
  }

  override destroy(fromScene?: boolean) {
    this.nameLabel.destroy()
    super.destroy(fromScene)
  }
}
