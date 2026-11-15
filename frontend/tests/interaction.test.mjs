import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { isNearObject } from '../src/game/interaction.ts'
import { GAME_EVENTS } from '../src/game/gameEvents.ts'

const require = createRequire(import.meta.url)
const JustDown = require('phaser/src/input/keyboard/keys/JustDown.js')
const computer = { x: 620, y: 330, width: 112, height: 72 }

test('컴퓨터 가장자리의 상하좌우에서 접근할 수 있다', () => {
  for (const [x, y] of [[620, 390], [620, 270], [540, 330], [700, 330]]) {
    assert.equal(isNearObject(x, y, computer, 56), true)
  }
})

test('거리 경계는 포함하고 경계 바깥은 제외한다', () => {
  assert.equal(isNearObject(620, 422, computer, 56), true)
  assert.equal(isNearObject(620, 422.01, computer, 56), false)
  assert.equal(isNearObject(400, 400, computer, 56), false)
})

test('모서리에서도 원형 거리로 범위를 제한한다', () => {
  assert.equal(isNearObject(716, 406, computer, 56), false)
  assert.equal(isNearObject(706, 396, computer, 56), true)
})

// 렌더링과 물리 엔진을 대체해 장면의 입력·이벤트 흐름만 검증한다.
// 실제 충돌과 React 패널 표시 여부는 브라우저에서 별도로 검증한다.
function createScene() {
  const uiEvents = new EventEmitter()
  const key = { _justDown: false }
  class Scene {
    constructor() {
      this.events = new EventEmitter()
      this.cameras = { main: { setBackgroundColor() {} } }
      this.physics = { add: { collider() {} } }
      this.input = { keyboard: { addKey: () => key } }
      this.add = {
        text: () => ({
          visible: true,
          setOrigin() { return this },
          setVisible(value) { this.visible = value; return this },
        }),
      }
    }
  }
  class Player {
    constructor(_scene, x, y) { this.x = x; this.y = y; this.movementEnabled = true }
    update(enabled = true) { this.movementEnabled = enabled }
  }
  const source = stripTypeScriptTypes(readFileSync(new URL('../src/game/scenes/LabLobbyScene.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '')
    .replace('export default class LabLobbyScene', 'class LabLobbyScene')
  const LobbyScene = vm.runInNewContext(source + '\nLabLobbyScene', {
    Phaser: { Scene, Input: { Keyboard: { JustDown } }, Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
    Player, createLobbyMap: () => ({}), COMPUTER: computer, GAME_EVENTS, isNearObject,
  })
  const scene = new LobbyScene(uiEvents)
  scene.create()
  return { scene, uiEvents, key }
}

test('범위 밖 E는 무시하고 나중에 접근해도 예약 실행하지 않는다', () => {
  const { scene, uiEvents, key } = createScene()
  let opens = 0
  uiEvents.on(GAME_EVENTS.openResearch, () => opens++)
  key._justDown = true
  scene.update()
  scene.player.x = 620
  scene.update()
  assert.equal(opens, 0)
  assert.equal(scene.interactionHint.visible, true)
  scene.player.x = 400
  scene.update()
  assert.equal(scene.interactionHint.visible, false)
})

test('한 번 누른 E는 한 번만 열고 패널 동안 이동을 잠근다', () => {
  const { scene, uiEvents, key } = createScene()
  let opens = 0
  uiEvents.on(GAME_EVENTS.openResearch, () => opens++)
  scene.player.x = 620
  key._justDown = true
  for (let frame = 0; frame < 120; frame++) scene.update()
  assert.equal(opens, 1)
  assert.equal(scene.player.movementEnabled, false)
  assert.equal(scene.interactionHint.visible, false)
})

test('패널 표시 중 E를 소비하고 닫은 뒤 새 입력으로만 다시 연다', () => {
  const { scene, uiEvents, key } = createScene()
  let opens = 0
  uiEvents.on(GAME_EVENTS.openResearch, () => opens++)
  scene.player.x = 620
  key._justDown = true
  scene.update()
  key._justDown = true
  scene.update()
  uiEvents.emit(GAME_EVENTS.closeResearch)
  scene.update()
  assert.equal(opens, 1)
  assert.equal(scene.player.movementEnabled, true)
  key._justDown = true
  scene.update()
  assert.equal(opens, 2)
})

test('20회 개폐해도 리스너가 늘지 않고 장면 종료 시 제거한다', () => {
  const { scene, uiEvents, key } = createScene()
  scene.player.x = 620
  for (let cycle = 0; cycle < 20; cycle++) {
    key._justDown = true
    scene.update()
    assert.equal(scene.player.movementEnabled, false)
    uiEvents.emit(GAME_EVENTS.closeResearch)
    scene.update()
    assert.equal(scene.player.movementEnabled, true)
    assert.equal(uiEvents.listenerCount(GAME_EVENTS.closeResearch), 1)
  }
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(GAME_EVENTS.closeResearch), 0)
  scene.create()
  assert.equal(uiEvents.listenerCount(GAME_EVENTS.closeResearch), 1)
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(GAME_EVENTS.closeResearch), 0)
})
