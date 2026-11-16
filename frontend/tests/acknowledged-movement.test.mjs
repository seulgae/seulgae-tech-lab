import assert from 'node:assert/strict'
import test from 'node:test'
import AcknowledgedMovement from '../src/game/multiplayer/AcknowledgedMovement.ts'
import { constrainedPosition } from '../src/game/multiplayer/networkPosition.ts'

function move(point, command) {
  const length = Math.hypot(command.x, command.y)
  return length ? constrainedPosition(point.x, point.y, command.x / length * 200 * command.ms / 1000,
    command.y / length * 200 * command.ms / 1000) : { ...point }
}

test('RTT 100~1600ms·지터·몰림·정지·재출발에서도 처리 완료 ack를 재생하면 잔여 미끄러짐이 없다', t => {
  for (const latency of [3, 12, 30, 48]) {
    const prediction = new AcknowledgedMovement()
    let local = { x: 400, y: 440 }, server = { ...local }, seq = 0, corrections = 0
    const messages = [], states = []
    prediction.reset({ ...server, ack: -1 })
    prediction.reconcile(local)
    // 한 tick=60Hz. 마지막 3초는 완전 정지해 지연된 stop ACK까지 확인한다.
    for (let tick = 0; tick < 600; tick++) {
      if (tick < 420) {
        const phase = Math.floor(tick / 35) % 6
        const [x, y] = [[1,0],[-1,0],[1,-1],[0,-1],[-1,1],[0,0]][phase]
        const command = { x, y, ms: x || y ? 1000 / 60 : 0, seq: ++seq }
        local = move(local, command); prediction.record(command)
        messages.push({ command, due: tick + latency + (Math.floor(tick / 20) % 2 ? 5 : 0) })
      }
      // TCP의 순서를 보존하면서 가변 지연으로 묶음 수신한다.
      while (messages.length && messages[0].due <= tick) {
        const { command } = messages.shift(); server = move(server, command)
        states.push({ ...server, ack: command.seq, due: tick + latency + tick % 7 })
      }
      while (states.length && states[0].due <= tick) prediction.receive(states.shift())
      const corrected = prediction.reconcile(local)
      if (corrected) { corrections++; local = corrected }
    }
    assert.equal(corrections, 0)
    assert.deepEqual(local, server)
    t.diagnostic(`기본 RTT=${Math.round(latency * 2 * 1000 / 60)}ms: corrections=${corrections}`)
  }
})

test('같은 ack·오래된 응답으로 정지 위치를 반복 보정하지 않고 재접속 시 미확인 입력을 버린다', () => {
  const prediction = new AcknowledgedMovement()
  prediction.reset({ x: 400, y: 440, ack: -1 }); prediction.reconcile({ x: 400, y: 440 })
  prediction.record({ x: 1, y: 0, ms: 50, seq: 1 })
  prediction.receive({ x: 405, y: 440, ack: 1 })
  assert.deepEqual(prediction.reconcile({ x: 410, y: 440 }), { x: 405, y: 440 })
  prediction.receive({ x: 100, y: 100, ack: 1 })
  prediction.receive({ x: 100, y: 100, ack: 0 })
  assert.equal(prediction.reconcile({ x: 405, y: 440 }), null)
  prediction.record({ x: 1, y: 0, ms: 50, seq: 2 })
  prediction.reset({ x: 428, y: 400, ack: -1 })
  assert.deepEqual(prediction.reconcile({ x: 415, y: 440 }), { x: 428, y: 400 })
})
