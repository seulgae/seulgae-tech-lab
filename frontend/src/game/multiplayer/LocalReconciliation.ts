import type { PlayerState } from '../../features/multiplayer/model/protocol'

type Point = { x: number; y: number }

/**
 * 서버 ack에 해당하는 과거 예측 위치로 오차를 계산하고 프레임별 보정량을 제한한다.
 *
 * @author seulgae
 * @version 1.0, 지연을 위치 오차로 오인하지 않는 로컬 예측 기록
 * @see "None"
 */
export default class LocalReconciliation {
  private readonly history = new Map<number, Point>()
  private pending = { x: 0, y: 0 }
  private hard: Point | null = null
  private lastAck = -1
  private missingSince: number | null = null
  lastError = 0

  record(sequence: number, position: Point) {
    this.history.set(sequence, { ...position })
    if (this.history.size > 256) this.history.delete(this.history.keys().next().value!)
  }

  reset(position?: Point) {
    this.history.clear(); this.pending = { x: 0, y: 0 }; this.hard = position ? { x: position.x, y: position.y } : null
    this.lastAck = -1; this.missingSince = null; this.lastError = 0
  }

  /** 이미 처리한 입력 이후의 로컬 이동은 보존하고, 같은 이동 ack의 반복 보정은 피한다. */
  receive(state: PlayerState, current: Point, now: number) {
    if (state.ack < this.lastAck || state.ack === this.lastAck && state.moving) return
    const predicted = this.history.get(state.ack)
    if (!predicted) {
      this.missingSince ??= now
      if (now - this.missingSince >= 1000 && Math.hypot(state.x - current.x, state.y - current.y) > 128) this.reset(state)
      return
    }
    this.missingSince = null
    this.lastAck = state.ack
    const x = state.x - predicted.x, y = state.y - predicted.y
    this.lastError = Math.hypot(x, y)
    if (this.lastError > 128) { this.reset(state); return }
    // 서버 고정 틱의 최대 10px 이동과 렌더링 프레임 차이를 허용한다.
    const tolerance = state.moving ? 16 : 2
    this.pending = this.lastError > tolerance ? { x, y } : { x: 0, y: 0 }
    for (const sequence of this.history.keys()) if (sequence < state.ack) this.history.delete(sequence)
  }

  takeHardPosition() { const position = this.hard; this.hard = null; return position }

  /** 일반 보정은 초당 60px 이하로 제한해 초당 200px 키 이동을 역전시키지 않는다. */
  step(delta: number) {
    const distance = Math.hypot(this.pending.x, this.pending.y)
    const amount = Math.min(distance * (1 - Math.exp(-Math.max(0, delta) / 120)), 60 * Math.min(50, Math.max(0, delta)) / 1000)
    const scale = distance > 0 ? amount / distance : 0
    return { x: this.pending.x * scale, y: this.pending.y * scale }
  }

  /** 적용한 만큼 예측 기록도 옮겨 같은 오차를 중복 보정하지 않는다. */
  applied(actual: Point, requested: Point) {
    for (const position of this.history.values()) { position.x += actual.x; position.y += actual.y }
    this.pending.x = Math.abs(actual.x - requested.x) > 0.001 ? 0 : this.pending.x - actual.x
    this.pending.y = Math.abs(actual.y - requested.y) > 0.001 ? 0 : this.pending.y - actual.y
  }
}
