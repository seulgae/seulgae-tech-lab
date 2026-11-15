import type { MoveInput } from '../../features/multiplayer/model/protocol'

/**
 * netDebug=1인 로컬 검증 화면에서만 5초마다 이동 품질의 집계치를 출력한다.
 * @author seulgae
 * @version 1.0, 프레임·보정·방향 역전 진단
 * @see "None"
 */
export default class MovementDiagnostics {
  private readonly enabled = new URLSearchParams(window.location.search).get('netDebug') === '1'
  private elapsed = 0
  private frames = 0
  private corrections = 0
  private hardSyncs = 0
  private correctionDistance = 0
  private reverseFrames = 0
  private maxError = 0
  private inputs = 0
  private snapshots = 0
  private previous: { x: number; y: number; input: MoveInput } | null = null

  corrected(distance: number, hard = false) {
    if (!this.enabled || distance < 0.0001) return
    this.corrections++; this.correctionDistance += distance
    if (hard) this.hardSyncs++
  }

  sent() { if (this.enabled) this.inputs++ }
  received() { if (this.enabled) this.snapshots++ }

  frame(x: number, y: number, input: MoveInput, delta: number, error: number) {
    if (!this.enabled) return
    this.elapsed += delta; this.frames++; this.maxError = Math.max(this.maxError, error)
    const previous = this.previous
    if (previous && previous.input.x === input.x && previous.input.y === input.y
      && (x - previous.x) * input.x + (y - previous.y) * input.y < -0.1) this.reverseFrames++
    this.previous = { x, y, input: { ...input } }
    if (this.elapsed < 5000) return
    console.info('[multiplayer:movement]', JSON.stringify({
      fps: Math.round(this.frames * 1000 / this.elapsed * 10) / 10,
      corrections: this.corrections, hardSyncs: this.hardSyncs,
      correctionPx: Math.round(this.correctionDistance * 10) / 10,
      maxErrorPx: Math.round(this.maxError * 10) / 10, reverseFrames: this.reverseFrames,
      inputHz: Math.round(this.inputs * 10000 / this.elapsed) / 10,
      snapshotHz: Math.round(this.snapshots * 10000 / this.elapsed) / 10,
    }))
    this.elapsed = 0; this.frames = 0; this.corrections = 0; this.hardSyncs = 0
    this.correctionDistance = 0; this.reverseFrames = 0; this.maxError = 0
    this.inputs = 0; this.snapshots = 0
  }
}
