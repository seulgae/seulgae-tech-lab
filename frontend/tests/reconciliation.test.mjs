import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'
import test from 'node:test'
import LocalReconciliation from '../src/game/multiplayer/LocalReconciliation.ts'
import AcknowledgedMovement from '../src/game/multiplayer/AcknowledgedMovement.ts'
import { constrainedPosition, translateBody } from '../src/game/multiplayer/networkPosition.ts'
import { crispText } from '../src/game/render/renderScale.ts'

const require = createRequire(import.meta.url)
const Body = require('phaser/src/physics/arcade/Body.js')

function physicsPlayer() {
  const sprite = { x: 400, y: 400, angle: 0, rotation: 0, scaleX: 2, scaleY: 2,
    displayOriginX: 8, displayOriginY: 24, displayWidth: 32, displayHeight: 48,
    setPosition(x, y) { this.x = x; this.y = y; return this },
    getTopLeft(point) { return point.set(this.x - 16, this.y - 48) },
  }
  const body = new Body({ defaults: {}, bounds: {}, updateMotion() {} }, sprite)
  body.setSize(10, 8, false); body.setOffset(3, 16); body.updateFromGameObject()
  return { sprite, body }
}

test('실제 Phaser reset은 발밑 offset·속도·충돌 상태를 변경하지만 보정 이동은 보존한다', () => {
  const old = physicsPlayer()
  old.body.velocity.set(200, 0); old.body.blocked.right = true
  old.body.reset(390, 400)
  assert.equal(old.body.velocity.x, 0)
  assert.equal(old.body.blocked.right, false)
  assert.deepEqual([old.body.x, old.body.y], [374, 352])
  old.body.preUpdate(true, 0)
  assert.deepEqual([old.body.x, old.body.y], [380, 384])
  const { sprite, body } = physicsPlayer()
  body.velocity.set(200, 0); body.blocked.right = true
  translateBody(sprite, body, -10, 0)
  assert.deepEqual([body.x, body.y], [380, 384])
  assert.equal(body.velocity.x, 200); assert.equal(body.blocked.right, true)
  body.preUpdate(true, 1 / 60); body.postUpdate()
  assert.ok(Math.abs(sprite.x - (390 + 200 / 60)) < 1e-8)
  assert.equal(sprite.y, 400)
})

function delayedRun(direction, revised) {
  const { sprite, body } = physicsPlayer()
  const reconciliation = new LocalReconciliation()
  const speed = { x: direction.x * 200, y: direction.y * 200 }
  let corrections = 0, backwards = 0, correctionDistance = 0
  const states = []
  for (let frame = 1; frame <= 60; frame++) {
    const before = { x: sprite.x, y: sprite.y }
    body.velocity.set(speed.x, speed.y)
    body.preUpdate(true, 1 / 60)
    if (frame % 3 === 0) {
      const sequence = frame / 3
      reconciliation.record(sequence, { x: sprite.x, y: sprite.y })
      states.push({ due: frame + 9, ack: sequence, x: 400 + speed.x * frame / 60, y: 400 + speed.y * frame / 60, moving: true })
    }
    const state = states.find(state => state.due === frame)
    if (state) {
      if (revised) reconciliation.receive(state, sprite, frame * 1000 / 60)
      else {
        const distance = Math.hypot(sprite.x - state.x, sprite.y - state.y)
        if (distance > 24) {
          const x = (state.x - sprite.x) * 0.25, y = (state.y - sprite.y) * 0.25
          body.reset(sprite.x + x, sprite.y + y)
          corrections++; correctionDistance += Math.hypot(x, y)
        }
      }
    }
    body.postUpdate()
    if (revised) {
      const change = reconciliation.step(1000 / 60)
      if (change.x || change.y) { translateBody(sprite, body, change.x, change.y); reconciliation.applied(change, change); corrections++; correctionDistance += Math.hypot(change.x, change.y) }
    }
    if ((sprite.x - before.x) * direction.x + (sprite.y - before.y) * direction.y < -0.01) backwards++
  }
  return { corrections, backwards, correctionDistance, distance: Math.hypot(sprite.x - 400, sprite.y - 400) }
}

test('150ms 지연의 60Hz 물리 재현: 네 방향·대각선 모두 역방향 프레임과 불필요한 보정을 제거한다', t => {
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], ...[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y]) => [x*Math.SQRT1_2,y*Math.SQRT1_2])]) {
    const before = delayedRun({ x, y }, false), after = delayedRun({ x, y }, true)
    assert.ok(before.corrections > 0)
    assert.ok(before.backwards > 0)
    assert.equal(after.backwards, 0)
    assert.equal(after.corrections, 0)
    assert.ok(Math.abs(after.distance - 200) < 1e-7)
    t.diagnostic(JSON.stringify({ direction: [x, y], before, after }))
  }
})

test('보정은 ack 이후 로컬 진행을 보존하며 같은 이동 ack와 오래된 응답을 반복 적용하지 않는다', () => {
  const prediction = new LocalReconciliation()
  prediction.record(1, { x: 400, y: 400 })
  prediction.receive({ ack: 1, x: 370, y: 400, moving: true }, { x: 450, y: 400 }, 0)
  const change = prediction.step(1000 / 60)
  assert.ok(change.x >= -1.00001 && change.x < 0)
  prediction.applied(change, change)
  prediction.receive({ ack: 1, x: 300, y: 400, moving: true }, { x: 450, y: 400 }, 50)
  prediction.receive({ ack: 0, x: 10, y: 10, moving: true }, { x: 450, y: 400 }, 100)
  assert.equal(prediction.takeHardPosition(), null)
  assert.ok(prediction.step(16).x >= -1)
})

test('서버 틱 오차가 허용 경계 16px를 넘나들어도 보정 속도가 갑자기 뛰지 않는다', t => {
  function correction(error) {
    const prediction = new LocalReconciliation()
    prediction.record(1, { x: 400, y: 400 })
    prediction.receive({ ack: 1, x: 400 - error, y: 400, moving: true }, { x: 430, y: 400 }, 0)
    return prediction.step(1000 / 60).x
  }
  const inside = correction(15.9), outside = correction(16.1)
  assert.equal(inside, 0)
  assert.ok(Math.abs(outside - inside) < 0.02, `허용 경계에서 한 프레임 보정 변화: ${outside - inside}px`)
  t.diagnostic(`16.1px 오차의 60Hz 한 프레임 보정: ${Math.abs(outside).toFixed(4)}px`)
})

test('늦게 도착한 서버 정지 상태가 새 이동 중인 캐릭터에 2px 정지 보정을 걸지 않는다', () => {
  for (const input of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 1 }]) {
    const prediction = new LocalReconciliation()
    prediction.record(1, { x: 400, y: 400 })
    prediction.receive({ ack: 1, x: 408, y: 400, moving: false }, { x: 430, y: 400 }, 0, input)
    assert.deepEqual(prediction.step(1000 / 60), { x: 0, y: 0 })
  }
})

test('정지 후에는 작은 잔여 오차를 단조롭게 2px까지 줄이고 경계에서 흔들리지 않는다', () => {
  const prediction = new LocalReconciliation(), position = { x: 408, y: 400 }
  prediction.record(1, position)
  for (let frame = 0; frame < 180; frame++) {
    if (frame % 3 === 0) prediction.receive({ ack: 1, x: 400, y: 400, moving: false }, position, frame * 1000 / 60)
    const correction = prediction.step(1000 / 60)
    assert.ok(correction.x <= 0 && position.x + correction.x >= 402 - 1e-8)
    position.x += correction.x
    prediction.applied(correction, correction)
  }
  assert.ok(Math.abs(position.x - 402) < 0.001)
})

test('큰 오차·재접속은 한 번 동기화하고, 누락된 예측 기록은 즉시 역행시키지 않는다', () => {
  const prediction = new LocalReconciliation()
  prediction.reset({ x: 400, y: 400 })
  assert.deepEqual(prediction.takeHardPosition(), { x: 400, y: 400 })
  assert.equal(prediction.takeHardPosition(), null)
  prediction.record(2, { x: 600, y: 400 })
  prediction.receive({ ack: 2, x: 400, y: 400, moving: false }, { x: 600, y: 400 }, 10)
  assert.deepEqual(prediction.takeHardPosition(), { x: 400, y: 400 })
  prediction.reset()
  prediction.receive({ ack: 99, x: 400, y: 400, moving: true }, { x: 700, y: 400 }, 20)
  assert.equal(prediction.takeHardPosition(), null)
  prediction.receive({ ack: 99, x: 400, y: 400, moving: true }, { x: 700, y: 400 }, 1020)
  assert.deepEqual(prediction.takeHardPosition(), { x: 400, y: 400 })
})

test('보정 경로는 공유 바닥 경계·책상·컴퓨터 충돌을 유지한다', () => {
  assert.equal(constrainedPosition(400, 400, 0, -1000).y, 238)
  assert.equal(constrainedPosition(620, 400, 0, -1000).y, 382)
  assert.equal(constrainedPosition(400, 80, -1000, 0).x, 34)
  assert.equal(constrainedPosition(400, 80, 1000, 0).x, 766)
  assert.equal(constrainedPosition(400, 500, 0, 1000).y, 576)
})

test('수신 콜백은 위치를 쓰지 않고 postUpdate에서만 보정하며 장면 종료 시 리스너를 제거한다', () => {
  let callbacks
  class Client {
    subscribe(value) { callbacks = value; return () => { this.unsubscribed = true } }
    start() {} destroy() {} setInput() {} usesCommands() { return false } recordStep() {}
  }
  const label = { setOrigin() { return this }, setResolution() { return this }, setPosition() { return this }, destroy() {} }
  const scene = { add: { text: () => label }, events: new EventEmitter(), physics: { world: new EventEmitter() } }
  const player = { x: 400, y: 400, changes: 0, getInput: () => ({ x: 1, y: 0 }), labelAnchor() { return { x: this.x, y: this.y - 55 } },
    correctPosition(x, y) { const delta = { x: x-this.x, y: y-this.y }; this.x=x;this.y=y;this.changes++;return delta },
  }
  const source = stripTypeScriptTypes(readFileSync(new URL('../src/game/multiplayer/LobbyMultiplayer.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replace('export default class LobbyMultiplayer', 'class LobbyMultiplayer')
  const Bridge = vm.runInNewContext(source+'\nLobbyMultiplayer', {
    MultiplayerClient: Client, LocalReconciliation, AcknowledgedMovement, crispText,
    Phaser: { Scenes: { Events: { POST_UPDATE: 'postupdate' } }, Physics: { Arcade: { Events: { WORLD_STEP: 'worldstep' } } } },
    MovementDiagnostics: class { sent() {} received() {} frame() {} corrected() {} }, Date,
  })
  const connection = new Client()
  const bridge = new Bridge(scene, player, connection)
  callbacks.snapshot([{ id: 'self', x: 400, y: 400, ack: -1, moving: false }], 'self')
  assert.equal(player.changes, 0)
  scene.events.emit('postupdate')
  assert.equal(player.changes, 1)
  player.x = 430; callbacks.inputSent(1)
  callbacks.snapshot([{ id: 'self', x: 438, y: 400, ack: 1, moving: false }], 'self')
  scene.events.emit('postupdate')
  assert.equal(player.x, 430)
  assert.equal(player.changes, 1)
  callbacks.inputSent(2)
  callbacks.snapshot([{ id: 'self', x: 400, y: 400, ack: 2, moving: true }], 'self')
  assert.equal(player.x, 430)
  scene.events.emit('postupdate')
  assert.ok(player.x < 430 && player.x >= 428.999)
  const stoppedWorld = scene.physics.world
  scene.physics.world = null
  bridge.destroy()
  scene.physics.world = stoppedWorld
  assert.equal(connection.unsubscribed, true)
  assert.equal(scene.events.listenerCount('postupdate'), 0)
  const changes = player.changes
  scene.events.emit('postupdate')
  assert.equal(player.changes, changes)
  assert.equal(scene.physics.world.listenerCount('worldstep'), 0)

  // 30Hz 렌더 프레임에 물리 스텝이 두 번 돌아도 각각 기록하고 ack 뒤의 한 스텝만 재생한다.
  let sequence = 0
  connection.usesCommands = () => true
  connection.recordStep = (input, ms) => {
    player.x += input.x * 200 * ms / 1000
    callbacks.predicted({ ...input, ms, seq: ++sequence })
  }
  const commandBridge = new Bridge(scene, player, connection)
  callbacks.snapshot([{ id: 'new', x: 400, y: 400, ack: -1 }], 'new')
  scene.events.emit('postupdate')
  const spawnChanges = player.changes
  scene.physics.world.emit('worldstep', 1 / 60)
  scene.physics.world.emit('worldstep', 1 / 60)
  callbacks.snapshot([{ id: 'new', x: 400 + 200 / 60, y: 400, ack: 1 }], 'new')
  scene.events.emit('postupdate')
  assert.equal(sequence, 2)
  assert.equal(player.changes, spawnChanges)
  assert.ok(Math.abs(player.x - (400 + 400 / 60)) < 1e-8)
  commandBridge.destroy()
  assert.equal(scene.physics.world.listenerCount('worldstep'), 0)
})
