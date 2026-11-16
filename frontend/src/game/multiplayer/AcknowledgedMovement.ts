import type { MoveCommand, PlayerState } from '../../features/multiplayer/model/protocol'
import { constrainedPosition } from './networkPosition.ts'

type Point = { x: number; y: number }

/**
 * 서버가 완료한 입력의 위치에서 미확인 물리 스텝만 재생해 현재 예측 위치를 구한다.
 * @author seulgae
 * @version 1.0, 처리 완료 ack와 입력 재생을 이용한 시간 기준 일치
 * @see "None"
 */
export default class AcknowledgedMovement {
  private readonly commands = new Map<number, MoveCommand>()
  private pending: PlayerState | null = null
  private lastAck = -2
  lastError = 0

  /** 새 세션의 스폰 위치와 입력 번호로 예측을 초기화한다. */
  reset(state?: PlayerState) {
    this.commands.clear(); this.pending = state ?? null; this.lastAck = -2; this.lastError = 0
  }

  /** 실제 Arcade 물리 스텝의 방향·시간을 서버에 보낸 순서로 보존한다. */
  record(command: MoveCommand) {
    this.commands.set(command.seq, command)
    return this.commands.size <= 600
  }

  receive(state: PlayerState) {
    if (state.ack <= this.lastAck || this.pending && state.ack < this.pending.ack) return
    this.pending = state
  }

  /** 물리 프레임 완료 후 서버 위치에 미확인 이동을 재생한다. 같은 ack는 다시 적용하지 않는다. */
  reconcile(current: Point): Point | null {
    const state = this.pending
    if (!state) { this.lastError = 0; return null }
    this.pending = null; this.lastAck = state.ack
    for (const seq of this.commands.keys()) if (seq <= state.ack) this.commands.delete(seq)
    let position: Point = { x: state.x, y: state.y }
    for (const command of this.commands.values()) {
      const length = Math.hypot(command.x, command.y)
      if (length) position = constrainedPosition(position.x, position.y,
        command.x / length * 200 * command.ms / 1000, command.y / length * 200 * command.ms / 1000)
    }
    this.lastError = Math.hypot(position.x - current.x, position.y - current.y)
    return this.lastError > 0.01 ? position : null
  }
}
