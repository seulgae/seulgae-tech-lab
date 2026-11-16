import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { ROOMS, nearestInteraction, roomObstacles } from '../src/game/maps/rooms.ts'
import { LAB_EVENTS } from '../src/features/lab/labEvents.ts'
import { ROOM_THEMES } from '../src/game/rooms/roomThemes.ts'
import { crispText } from '../src/game/render/renderScale.ts'
import { isNearObject } from '../src/game/interaction.ts'
import { RESEARCH_EVENTS } from '../src/features/research/researchEvents.ts'
import { MOBILE_INPUT } from '../src/game/input/mobileInput.ts'
import { MULTIPLAYER_EVENTS } from '../src/features/multiplayer/model/protocol.ts'

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
function createScene(room = 'lobby') {
  const uiEvents = new EventEmitter()
  const key = { _justDown: false }
  const state = { textFocused: false, resets: 0 }
  // 방 연출은 별도 모듈이므로 호출 기록만 남기는 대역을 쓴다.
  const fx = {
    calls: [], intercepting: false, hintText: undefined,
    doors: { open: id => fx.calls.push(['open', id]), close: id => fx.calls.push(['close', id]), remainingOpenMs: () => 0 },
    intercept: target => { fx.calls.push(['intercept', target.kind]); return fx.intercepting },
    hint: () => fx.hintText,
    setTableTalk: active => fx.calls.push(['tableTalk', active]),
    destroy: () => fx.calls.push(['destroy']),
  }
  state.fx = fx
  class Scene {
    constructor() {
      this.events = new EventEmitter()
      this.cameras = { main: { setBackgroundColor() {}, fadeIn() {}, fadeOut() {} } }
      this.time = { now: 0 }
      this.scale = { listeners: new Set(), on(_event, fn) { this.listeners.add(fn) }, off(_event, fn) { this.listeners.delete(fn) } }
      this.physics = { add: { collider() {} } }
      this.input = { keyboard: { addKey: () => key, resetKeys: () => { state.resets++ } } }
      this.add = {
        text: () => ({
          visible: true,
          setOrigin() { return this },
          setResolution() { return this },
          setDepth() { return this },
          setVisible(value) { this.visible = value; return this },
          setText(value) { this.text = value; return this },
          setPosition() { return this },
        }),
      }
    }
  }
  class Player {
    constructor(_scene, x, y) { this.x = x; this.y = y; this.movementEnabled = true }
    update(enabled = true, touch = { x: 0, y: 0 }) { this.movementEnabled = enabled; this.touch = enabled ? touch : { x: 0, y: 0 } }
    getInput() { return this.touch }
    sit(seat) { this.seat = seat }
    labelAnchor() { return { x: this.x, y: this.y - 55 } }
  }
  const source = stripTypeScriptTypes(readFileSync(new URL('../src/game/scenes/LabLobbyScene.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '')
    .replace('export default class LabLobbyScene', 'class LabLobbyScene')
  const LobbyScene = vm.runInNewContext(source + '\nLabLobbyScene', {
    Phaser: { Scene, Input: { Keyboard: { JustDown } }, Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
    ROOMS, roomObstacles, nearestInteraction, setRoomObstacles() {}, Player, createLobbyMap: () => ({}), RESEARCH_EVENTS, LAB_EVENTS,
    createRoomAssets() {}, ROOM_THEMES, createRoomFx: () => fx, crispText,
    applyRenderZoom: () => { state.zoomApplied = (state.zoomApplied ?? 0) + 1 },
    hasTextInputFocus: () => state.textFocused,
    SPAWN: { x: 400, y: 400 }, MULTIPLAYER_EVENTS, MOBILE_INPUT, LobbyMultiplayer: class {
      update() {} destroy() {} stopInput() {}
    },
  })
  const scene = new LobbyScene(uiEvents, { currentRoom() { return room }, isTravelling() { return false }, subscribe() { return () => {} }, setInput(input) { state.sentInput = input }, changeRoom(id) { state.changed = id; return true },
    sit(id) { (state.sits ??= []).push(id); return true }, selfSeat() { return state.serverSeat ?? null } })
  scene.create()
  return { scene, uiEvents, key, state }
}

test('채팅 입력 포커스는 이동과 컴퓨터 E를 막고 키 상태를 초기화한다', () => {
  const { scene, uiEvents, key, state } = createScene()
  let opens = 0
  uiEvents.on(RESEARCH_EVENTS.openResearch, () => opens++)
  scene.player.x = 620
  state.textFocused = true
  uiEvents.emit('chat:focus')
  key._justDown = true; scene.update()
  assert.equal(opens, 0)
  assert.equal(scene.player.movementEnabled, false)
  assert.equal(state.resets, 1)
  state.textFocused = false; scene.update()
  assert.equal(opens, 0)
  assert.equal(scene.player.movementEnabled, true)
  key._justDown = true; scene.update()
  assert.equal(opens, 1)
})
test('범위 밖 E는 무시하고 나중에 접근해도 예약 실행하지 않는다', () => {
  const { scene, uiEvents, key } = createScene()
  let opens = 0
  uiEvents.on(RESEARCH_EVENTS.openResearch, () => opens++)
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
  uiEvents.on(RESEARCH_EVENTS.openResearch, () => opens++)
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
  uiEvents.on(RESEARCH_EVENTS.openResearch, () => opens++)
  scene.player.x = 620
  key._justDown = true
  scene.update()
  key._justDown = true
  scene.update()
  uiEvents.emit(RESEARCH_EVENTS.closeResearch)
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
    uiEvents.emit(RESEARCH_EVENTS.closeResearch)
    scene.update()
    assert.equal(scene.player.movementEnabled, true)
    assert.equal(uiEvents.listenerCount(RESEARCH_EVENTS.closeResearch), 1)
  }
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(RESEARCH_EVENTS.closeResearch), 0)
  scene.create()
  assert.equal(uiEvents.listenerCount(RESEARCH_EVENTS.closeResearch), 1)
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(RESEARCH_EVENTS.closeResearch), 0)
})

test('터치 이동은 채팅 포커스 전환 때 초기화되고 정지를 서버에 전달한다', () => {
  const { scene, uiEvents, state } = createScene()
  uiEvents.emit(MOBILE_INPUT.move, { x: 1, y: -1 }); scene.update()
  assert.deepEqual({ ...scene.player.touch }, { x: 1, y: -1 })
  let resets = 0
  uiEvents.on(MOBILE_INPUT.reset, () => resets++)
  uiEvents.emit('chat:focus'); scene.update()
  assert.deepEqual({ ...scene.player.touch }, { x: 0, y: 0 })
  assert.equal(resets, 1)
  uiEvents.emit(MOBILE_INPUT.move, { x: 0, y: 0 })
  assert.deepEqual({ ...state.sentInput }, { x: 0, y: 0 })
})

test('터치 E는 범위 밖에서 예약되지 않고 패널 동안 재실행되지 않는다', () => {
  const { scene, uiEvents } = createScene()
  let opens = 0
  uiEvents.on(RESEARCH_EVENTS.openResearch, () => opens++)
  uiEvents.emit(MOBILE_INPUT.interact); scene.update()
  scene.player.x = 620; scene.update()
  assert.equal(opens, 0)
  uiEvents.emit(MOBILE_INPUT.move, { x: 1, y: 0 })
  uiEvents.emit(MOBILE_INPUT.interact)
  for (let i = 0; i < 120; i++) scene.update()
  assert.equal(opens, 1)
  assert.equal(scene.player.movementEnabled, false)
  uiEvents.emit(MOBILE_INPUT.interact); scene.update()
  uiEvents.emit(RESEARCH_EVENTS.closeResearch); scene.update()
  assert.equal(opens, 1)
  assert.deepEqual({ ...scene.player.touch }, { x: 0, y: 0 })
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(MOBILE_INPUT.move), 0)
  assert.equal(uiEvents.listenerCount(MOBILE_INPUT.interact), 0)
  scene.create()
  assert.equal(uiEvents.listenerCount(MOBILE_INPUT.move), 1)
})

test('모든 방에 스폰과 겹치지 않는 상호작용이 있고 위치별로 하나만 고른다', () => {
  const kinds = new Set(['research', 'build-info', 'server-status', 'table-talk', 'agenda'])
  for (const [id, room] of Object.entries(ROOMS)) {
    assert.ok(room.interactions.length > 0, id)
    for (const interaction of room.interactions) {
      assert.ok(kinds.has(interaction.kind), interaction.id)
      assert.equal(isNearObject(room.spawn.x, room.spawn.y, interaction, interaction.range), false, `${interaction.id}: spawn`)
    }
  }
  assert.equal(nearestInteraction('lobby', 620, 400)?.kind, 'research')
  assert.equal(nearestInteraction('server-room', 220, 290)?.kind, 'server-status')
  assert.equal(nearestInteraction('development-lab', 620, 290)?.id, 'development-build-right')
  assert.equal(nearestInteraction('meeting-room', 350, 340)?.kind, 'table-talk')
  assert.equal(nearestInteraction('meeting-room', 400, 460), undefined)
})

test('서버실 랙과 개발 연구실 컴퓨터는 해당 패널만 열고 입력을 잠근다', () => {
  for (const [room, x, y, kind] of [['server-room', 220, 290, 'server-status'], ['development-lab', 180, 290, 'build-info']]) {
    const { scene, uiEvents, key } = createScene(room)
    const opened = []
    let research = 0
    uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
    uiEvents.on(RESEARCH_EVENTS.openResearch, () => research++)
    scene.player.x = x; scene.player.y = y
    scene.update()
    assert.equal(scene.interactionHint.text, kind === 'server-status' ? 'E · 서버 상태' : 'E · 빌드 정보')
    key._justDown = true
    for (let frame = 0; frame < 30; frame++) scene.update()
    assert.deepEqual(opened, [kind])
    assert.equal(research, 0)
    assert.equal(scene.player.movementEnabled, false)
    uiEvents.emit(LAB_EVENTS.closePanel); scene.update()
    assert.equal(scene.player.movementEnabled, true)
    scene.events.emit('shutdown')
    assert.equal(uiEvents.listenerCount(LAB_EVENTS.closePanel), 0)
  }
})

test('회의 테이블 E는 테이블 대화를 켜고 끄며 범위를 벗어나면 자동으로 끈다', () => {
  const { scene, uiEvents, key } = createScene('meeting-room')
  const states = []
  uiEvents.on(LAB_EVENTS.tableTalk, value => states.push(value))
  scene.player.x = 350; scene.player.y = 340
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 테이블 대화 참여')
  key._justDown = true; scene.update()
  assert.deepEqual(states, [true])
  assert.equal(scene.player.movementEnabled, true)
  assert.equal(scene.interactionHint.text, 'E · 테이블 대화 참여')
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 테이블 대화 나가기')
  key._justDown = true; scene.update()
  assert.deepEqual(states, [true, false])
  key._justDown = true; scene.update()
  scene.player.y = 460; scene.update()
  assert.deepEqual(states, [true, false, true, false])
  key._justDown = true; scene.player.y = 340; scene.update()
  scene.events.emit('shutdown')
  assert.equal(states.at(-1), false)
})

test('출입구 E는 문을 열고 이동을 요청하며, 장면 종료 시 방 연출을 정리한다', () => {
  const { scene, key, state } = createScene('lobby')
  scene.player.x = 400; scene.player.y = 530
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 개발 연구실 입장')
  key._justDown = true; scene.update()
  assert.equal(state.changed, 'lobby-to-development')
  assert.deepEqual(state.fx.calls.at(-1), ['open', 'lobby-to-development'])
  scene.events.emit('shutdown')
  assert.deepEqual(state.fx.calls.at(-1), ['destroy'])
})

test('방 이벤트가 E를 가로채면 패널을 열지 않고 안내 문구도 이벤트가 정한다', () => {
  const { scene, uiEvents, key, state } = createScene('server-room')
  const opened = []
  uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  state.fx.intercepting = true; state.fx.hintText = 'E · 냉각 시스템 가동'
  scene.player.x = 220; scene.player.y = 290
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 냉각 시스템 가동')
  key._justDown = true; scene.update()
  assert.deepEqual(opened, [])
  assert.equal(scene.player.movementEnabled, true)
  state.fx.intercepting = false; state.fx.hintText = undefined
  key._justDown = true; scene.update()
  assert.deepEqual(opened, ['server-status'])
})

test('테이블 대화 상태는 방 연출(회의 모드)에도 전달된다', () => {
  const { scene, key, state } = createScene('meeting-room')
  scene.player.x = 350; scene.player.y = 340
  key._justDown = true; scene.update()
  assert.deepEqual(state.fx.calls.filter(call => call[0] === 'tableTalk'), [['tableTalk', true]])
})

test('의자 E는 앉기를 요청하고 같은 의자 E는 일어나며, 서버가 확인하지 않으면 1.5초 뒤 일어난다', () => {
  const { scene, key, state } = createScene('lobby')
  // 로비 의자 0(620,418)은 키오스크 아래에 있다. 의자 뒤(아래)에서 다가간다.
  scene.player.x = 620; scene.player.y = 450
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 앉기')
  key._justDown = true; scene.update()
  assert.deepEqual(state.sits, ['lobby-chair-0'])
  assert.equal(scene.player.seat.id, 'lobby-chair-0')
  assert.equal(scene.interactionHint.text, 'E · 앉기')
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 일어나기')
  key._justDown = true; scene.update()
  assert.deepEqual(state.sits, ['lobby-chair-0', null])
  assert.equal(scene.player.seat, undefined)

  key._justDown = true; scene.update()
  state.serverSeat = null
  scene.time.now = 1600; scene.update()
  assert.equal(scene.player.seat, undefined, '서버가 거부하면 일어난다')
  key._justDown = true; scene.update()
  state.serverSeat = 'lobby-chair-0'
  scene.time.now = 4000; scene.update()
  assert.equal(scene.player.seat.id, 'lobby-chair-0', '서버가 확인하면 계속 앉아 있다')
})

test('회의실 의자에 앉으면 테이블 대화가 켜지고 일어나면 꺼진다', () => {
  const { scene, uiEvents, key, state } = createScene('meeting-room')
  const talk = []
  uiEvents.on(LAB_EVENTS.tableTalk, value => talk.push(value))
  scene.player.x = 400; scene.player.y = 385
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 앉기', '의자 뒤에서는 테이블보다 의자가 가깝다')
  key._justDown = true; scene.update()
  assert.deepEqual(state.sits, ['meeting-room-chair-1'])
  assert.deepEqual(talk, [true])
  scene.update()
  assert.deepEqual(talk, [true], '의자에 앉아 있는 동안 유지한다')
  scene.player.sit(undefined); scene.update()
  assert.deepEqual(talk, [true, false])
})

test('식물과 회의 안건은 방 연출·안건 패널로 전달된다', () => {
  const lobby = createScene('lobby')
  lobby.state.fx.intercepting = true
  lobby.scene.player.x = 66; lobby.scene.player.y = 150
  lobby.scene.update()
  assert.equal(lobby.scene.interactionHint.text, 'E · 식물 건드리기')
  lobby.key._justDown = true; lobby.scene.update()
  assert.deepEqual(lobby.state.fx.calls.at(-1), ['intercept', 'plant'])

  const meeting = createScene('meeting-room')
  const opened = []
  meeting.uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  meeting.scene.player.x = 400; meeting.scene.player.y = 196
  meeting.scene.update()
  assert.equal(meeting.scene.interactionHint.text, 'E · 회의 안건')
  meeting.key._justDown = true; meeting.scene.update()
  assert.deepEqual(opened, ['agenda'])
  assert.equal(meeting.scene.player.movementEnabled, false)
})
