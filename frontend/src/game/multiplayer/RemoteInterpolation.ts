import type { PlayerState } from '../../features/multiplayer/model/protocol'

type Sample = { at: number; state: PlayerState }

/**
 * 서버 시간의 위치 표본을 지터 버퍼에 보관해 일정한 재생 시간으로 원격 캐릭터를 그린다.
 * @author seulgae
 * @version 1.0, 중복 위치 제거·적응 버퍼·보간 및 긴 단절 복구
 * @see "None"
 */
export default class RemoteInterpolation {
  private samples: Sample[] = []
  private offsets: number[] = []
  private lastTime = -Infinity
  private playhead: number | null = null
  private lastRender = -Infinity
  private offset = 0
  bufferMs = 100

  /** 전송 지터와 서버/클라이언트 시계 차이를 분리하고 새 위치 표본을 저장한다. */
  push(state: PlayerState, at: number, receivedAt: number) {
    if (at <= this.lastTime) return
    if (this.samples.length && at - this.lastTime > 2000) {
      this.samples = []; this.offsets = []; this.playhead = null
    }
    this.lastTime = at
    this.offsets.push(receivedAt - at)
    if (this.offsets.length > 120) this.offsets.shift()
    this.offset = Math.min(...this.offsets)
    this.bufferMs = Math.min(650, 100 + Math.max(...this.offsets) - this.offset)
    const previous = this.samples.at(-1)
    const distance = previous ? Math.hypot(state.x - previous.state.x, state.y - previous.state.y) : 0
    if (previous) {
      // 이동 중 같은 좌표를 되풀이한 틱은 정지 구간으로 만들지 않는다.
      if (distance < 0.01 && state.moving === previous.state.moving && state.facing === previous.state.facing) return
      if (!previous.state.moving && distance > 0.01) {
        // 오래 쉰 뒤의 첫 이동을 과거 유휴 시간 전체에 걸쳐 보간하지 않는다.
        const start = Math.max(previous.at, at - distance / 200 * 1000)
        if (start > previous.at) this.samples.push({ at: start, state: previous.state })
      }
    }
    this.samples.push({ at, state: { ...state } })
    if (this.samples.length > 120) this.samples.splice(0, this.samples.length - 120)
  }

  /** 알려진 위치 사이만 보간하며, 표본이 끊기면 마지막 서버 위치에서 기다린다. */
  sample(now: number, delta: number) {
    const desired = now - this.offset - this.bufferMs
    if (this.playhead === null || now - this.lastRender > 1000 || Math.abs(desired - this.playhead) > 1500) this.playhead = desired
    else {
      const speed = Math.max(0.9, Math.min(1.1, 1 + (desired - this.playhead) / 1000))
      this.playhead += Math.max(0, Math.min(100, delta)) * speed
    }
    this.lastRender = now
    while (this.samples.length > 2 && this.samples[1]!.at <= this.playhead) this.samples.shift()
    const from = this.samples[0]!, to = this.samples[1]
    if (!to || this.playhead <= from.at) return from.state
    const alpha = Math.min(1, (this.playhead - from.at) / (to.at - from.at))
    return { ...to.state, x: from.state.x + (to.state.x - from.state.x) * alpha,
      y: from.state.y + (to.state.y - from.state.y) * alpha }
  }
}
