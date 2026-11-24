import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { ROOMS, doorHint, nearestInteraction, roomObstacles } from '../src/game/maps/rooms.ts'
import { FootstepTracker, footstepSound } from '../src/audio/soundRules.ts'
import { skyPhase } from '../src/game/rooms/timeOfDay.ts'
import { LAB_EVENTS } from '../src/features/lab/labEvents.ts'
import { ROOM_THEMES } from '../src/game/rooms/roomThemes.ts'
import { crispText } from '../src/game/render/renderScale.ts'
import { closerTarget, isNearObject } from '../src/game/interaction.ts'
import { PULLS_EVENTS } from '../src/features/pulls/pullsApi.ts'
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
    setTableTalk: (active, quiet) => fx.calls.push(['tableTalk', active, quiet]),
    locking: false,
    locksMovement: () => fx.locking,
    destroy: () => fx.calls.push(['destroy']),
  }
  state.fx = fx
  class Scene {
    constructor() {
      this.events = new EventEmitter()
      this.cameras = { main: { setBackgroundColor() {}, fadeIn() {}, fadeOut() {} } }
      // delayedCall은 바로 실행하지 않고 쌓아 두었다가 테스트가 runDelayed로 실행한다.
      this.time = { now: 0, delayedCall: (_ms, fn) => { (state.delayed ??= []).push(fn) }, addEvent() {} }
      this.scale = { listeners: new Set(), on(_event, fn) { this.listeners.add(fn) }, off(_event, fn) { this.listeners.delete(fn) } }
      this.physics = { add: { collider() {} } }
      // E와 I는 따로 누른다(I: 가방). 나머지 키는 E 대역을 함께 쓴다.
      state.iKey = { _justDown: false }
      state.capture = true
      this.input = { keyboard: { addKey: code => code === 'I' ? state.iKey : key, resetKeys: () => { state.resets++ },
        disableGlobalCapture: () => { state.capture = false }, enableGlobalCapture: () => { state.capture = true } } }
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
    ROOMS, doorHint, roomObstacles, nearestInteraction, setRoomObstacles() {}, Player, createLobbyMap: () => ({}), PULLS_EVENTS, LAB_EVENTS,
    createRoomAssets() {}, ROOM_THEMES, createRoomFx: () => fx, crispText,
    // 사운드: 재생한 효과음 이름만 기록한다. 발걸음 규칙은 실제 모듈을 쓴다.
    AudioManager: { for: () => ({ enterRoom: (room, phase) => { (state.rooms ??= []).push([room, phase]) } }) },
    playSfx: (key, options) => { (state.sounds ??= []).push(key) }, FootstepTracker, footstepSound, skyPhase,
    PetBot: class { constructor() { state.pets = (state.pets ?? 0) + 1 } update() {} destroy() {} },
    COIN_EVENT: 'lab:coin', OPEN_INVENTORY_EVENT: 'lab:open-inventory', FISH_COLORS: {}, inventoryStore: { refresh: async () => {} },
    applyRenderZoom: () => { state.zoomApplied = (state.zoomApplied ?? 0) + 1 },
    hasTextInputFocus: () => state.textFocused, closerTarget,
    SPAWN: { x: 400, y: 400 }, MULTIPLAYER_EVENTS, MOBILE_INPUT, LobbyMultiplayer: class {
      update() {} destroy() {} stopInput() {}
    },
  })
  const scene = new LobbyScene(uiEvents, { currentRoom() { return room }, isTravelling() { return false }, subscribe() { return () => {} }, setInput(input) { state.sentInput = input }, changeRoom(id) { state.changed = id; return true },
    sit(id) { (state.sits ??= []).push(id); return true }, selfSeat() { return state.serverSeat ?? null },
    ground() { return [] }, pickItem(id) { (state.picks ??= []).push(id); return true } })
  scene.create()
  const runDelayed = () => { const pending = state.delayed ?? []; state.delayed = []; pending.forEach(fn => fn()) }
  return { scene, uiEvents, key, state, runDelayed }
}

test('채팅 입력 포커스는 이동과 컴퓨터 E를 막고 키 상태를 초기화한다', () => {
  const { scene, uiEvents, key, state } = createScene('development-lab')
  let opens = 0
  uiEvents.on(PULLS_EVENTS.openPulls, () => opens++)
  scene.player.x = 400; scene.player.y = 290
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
  uiEvents.on(PULLS_EVENTS.openPulls, () => opens++)
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
  const { scene, uiEvents, key } = createScene('development-lab')
  let opens = 0
  uiEvents.on(PULLS_EVENTS.openPulls, () => opens++)
  scene.player.x = 400; scene.player.y = 290
  key._justDown = true
  for (let frame = 0; frame < 120; frame++) scene.update()
  assert.equal(opens, 1)
  assert.equal(scene.player.movementEnabled, false)
  assert.equal(scene.interactionHint.visible, false)
})

test('패널 표시 중 E를 소비하고 닫은 뒤 새 입력으로만 다시 연다', () => {
  const { scene, uiEvents, key } = createScene('development-lab')
  let opens = 0
  uiEvents.on(PULLS_EVENTS.openPulls, () => opens++)
  scene.player.x = 400; scene.player.y = 290
  key._justDown = true
  scene.update()
  key._justDown = true
  scene.update()
  uiEvents.emit(PULLS_EVENTS.closePulls)
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
    uiEvents.emit(PULLS_EVENTS.closePulls)
    scene.update()
    assert.equal(scene.player.movementEnabled, true)
    assert.equal(uiEvents.listenerCount(PULLS_EVENTS.closePulls), 1)
  }
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(PULLS_EVENTS.closePulls), 0)
  scene.create()
  assert.equal(uiEvents.listenerCount(PULLS_EVENTS.closePulls), 1)
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(PULLS_EVENTS.closePulls), 0)
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
  const { scene, uiEvents } = createScene('development-lab')
  let opens = 0
  uiEvents.on(PULLS_EVENTS.openPulls, () => opens++)
  // 스폰(아래 문 앞): 작업대·슈퍼컴퓨터 모두 범위 밖
  scene.player.y = 470
  uiEvents.emit(MOBILE_INPUT.interact); scene.update()
  scene.player.x = 400; scene.player.y = 290; scene.update()
  assert.equal(opens, 0)
  uiEvents.emit(MOBILE_INPUT.move, { x: 1, y: 0 })
  uiEvents.emit(MOBILE_INPUT.interact)
  for (let i = 0; i < 120; i++) scene.update()
  assert.equal(opens, 1)
  assert.equal(scene.player.movementEnabled, false)
  uiEvents.emit(MOBILE_INPUT.interact); scene.update()
  uiEvents.emit(PULLS_EVENTS.closePulls); scene.update()
  assert.equal(opens, 1)
  assert.deepEqual({ ...scene.player.touch }, { x: 0, y: 0 })
  scene.events.emit('shutdown')
  assert.equal(uiEvents.listenerCount(MOBILE_INPUT.move), 0)
  assert.equal(uiEvents.listenerCount(MOBILE_INPUT.interact), 0)
  scene.create()
  assert.equal(uiEvents.listenerCount(MOBILE_INPUT.move), 1)
})

test('모든 방에 스폰과 겹치지 않는 상호작용이 있고 위치별로 하나만 고른다', () => {
  const kinds = new Set(['vending-machine', 'water-dispenser', 'pull-requests', 'guestbook', 'build-info', 'server-status', 'table-talk', 'agenda', 'admin-console', 'admin-apply', 'fishing', 'my-desk', 'usemap', 'arcade', 'gamble'])
  for (const [id, room] of Object.entries(ROOMS)) {
    // 2·4번은 아직 빈 사무실이라 상호작용이 없다.
    if (id !== 'office-2' && id !== 'office-4') assert.ok(room.interactions.length > 0, id)
    for (const interaction of room.interactions) {
      assert.ok(kinds.has(interaction.kind), interaction.id)
      assert.equal(isNearObject(room.spawn.x, room.spawn.y, interaction, interaction.range), false, `${interaction.id}: spawn`)
    }
  }
  assert.equal(nearestInteraction('lobby', 620, 400)?.kind, 'guestbook', '로비 컴퓨터는 방명록')
  assert.equal(nearestInteraction('server-room', 220, 290)?.kind, 'server-status')
  assert.equal(nearestInteraction('development-lab', 400, 290)?.id, 'development-supercomputer', 'GitHub PR 목록은 개발 연구실 슈퍼컴퓨터')
  assert.equal(nearestInteraction('development-lab', 400, 440)?.id, 'development-build')
  assert.equal(nearestInteraction('meeting-room', 400, 420)?.kind, 'table-talk')
  assert.equal(nearestInteraction('meeting-room', 400, 460), undefined)
  assert.equal(nearestInteraction('control-room', 400, 280)?.kind, 'admin-console')
  assert.equal(nearestInteraction('outdoor', 612, 250)?.kind, 'fishing')
})

test('서버실 랙과 개발 연구실 컴퓨터는 해당 패널만 열고 입력을 잠근다', () => {
  for (const [room, x, y, kind] of [['server-room', 220, 290, 'server-status'], ['development-lab', 400, 440, 'build-info']]) {
    const { scene, uiEvents, key } = createScene(room)
    const opened = []
    let research = 0
    uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
    uiEvents.on(PULLS_EVENTS.openPulls, () => research++)
    scene.player.x = x; scene.player.y = y
    scene.update()
    assert.equal(scene.interactionHint.text, kind === 'server-status' ? 'E · 1번 랙 · CPU' : 'E · 빌드 정보')
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
  scene.player.x = 400; scene.player.y = 420
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
  // 아래 가운데 문은 바깥 초원으로 나가며, 공유 맵의 이름표("나가기")로 안내한다.
  scene.player.x = 400; scene.player.y = 530
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 나가기')
  key._justDown = true; scene.update()
  assert.equal(state.changed, 'lobby-to-outdoor')
  assert.deepEqual(state.fx.calls.at(-1), ['open', 'lobby-to-outdoor'])
  // 왼쪽 위 옆문은 개발 연구실
  scene.player.x = 90; scene.player.y = 280
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 개발 연구실 입장')
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
  scene.player.x = 400; scene.player.y = 420
  key._justDown = true; scene.update()
  assert.deepEqual(state.fx.calls.filter(call => call[0] === 'tableTalk'), [['tableTalk', true, false]], 'E로 켠 회의 모드는 배너로 알린다')
})

test('의자 E는 앉기를 요청하고 같은 의자 E는 일어나며, 서버가 확인하지 않으면 3초 뒤 일어난다', () => {
  const { scene, key, state } = createScene('control-room')
  // 관제실 의자 0(340,358)은 콘솔 아래에 있다. 의자 뒤(아래)에서 다가간다. 로비에는 의자가 없다.
  scene.player.x = 340; scene.player.y = 395
  scene.update()
  assert.equal(scene.interactionHint.text, 'E', '의자 안내는 E만 짧게 보여 준다')
  key._justDown = true; scene.update()
  assert.deepEqual(state.sits, ['control-room-chair-0'])
  assert.equal(scene.player.seat.id, 'control-room-chair-0')
  scene.update()
  assert.equal(scene.interactionHint.text, 'E', '앉은 뒤에도 같은 짧은 안내')
  key._justDown = true; scene.update()
  assert.deepEqual(state.sits, ['control-room-chair-0', null])
  assert.equal(scene.player.seat, undefined)

  key._justDown = true; scene.update()
  state.serverSeat = null
  scene.time.now = 2900; scene.update()
  assert.ok(scene.player.seat, '운영 지연(약 1초)을 고려해 3초까지는 서버 확인을 기다린다')
  scene.time.now = 3100; scene.update()
  assert.equal(scene.player.seat, undefined, '서버가 거부하면 일어난다')
  key._justDown = true; scene.update()
  state.serverSeat = 'control-room-chair-0'
  scene.time.now = 7000; scene.update()
  assert.equal(scene.player.seat.id, 'control-room-chair-0', '서버가 확인하면 계속 앉아 있다')
})

test('회의실 의자에 앉으면 테이블 대화가 켜지고 일어나면 꺼진다', () => {
  const { scene, uiEvents, key, state } = createScene('meeting-room')
  const talk = []
  uiEvents.on(LAB_EVENTS.tableTalk, value => talk.push(value))
  scene.player.x = 322; scene.player.y = 375
  scene.update()
  assert.equal(scene.interactionHint.text, 'E', '의자 뒤에서는 테이블보다 의자가 가깝다')
  key._justDown = true; scene.update()
  assert.deepEqual(state.sits, ['meeting-room-chair-4'])
  assert.deepEqual(talk, [true])
  scene.update()
  assert.deepEqual(talk, [true], '의자에 앉아 있는 동안 유지한다')
  scene.player.sit(undefined); scene.update()
  assert.deepEqual(talk, [true, false])
  assert.deepEqual(state.fx.calls.filter(call => call[0] === 'tableTalk'), [['tableTalk', true, true], ['tableTalk', false, true]],
    '의자로 자동 참여·해제할 때는 배너 없이 조용히 바꾼다')
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
  meeting.scene.player.x = 330; meeting.scene.player.y = 140
  meeting.scene.update()
  assert.equal(meeting.scene.interactionHint.text, 'E · 회의 안건')
  meeting.key._justDown = true; meeting.scene.update()
  assert.deepEqual(opened, ['agenda'])
  assert.equal(meeting.scene.player.movementEnabled, false)
})

test('로비 데스크의 커피·케이크는 방 연출이 처리하고 패널을 열지 않는다', () => {
  const { scene, uiEvents, key, state } = createScene('lobby')
  const opened = []
  uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  state.fx.intercepting = true
  for (const [x, kind, label] of [[445, 'coffee', 'E · 커피 마시기 · 2원'], [355, 'cake', 'E · 케이크 먹기 · 3원']]) {
    scene.player.x = x; scene.player.y = 240
    scene.update()
    assert.equal(scene.interactionHint.text, label)
    key._justDown = true; scene.update()
    assert.deepEqual(state.fx.calls.at(-1), ['intercept', kind])
  }
  assert.deepEqual(opened, [])
  assert.equal(scene.player.movementEnabled, true)
})

test('책장 E는 책이 날아오는 연출 뒤 책 읽기 창을 연다', () => {
  const { scene, uiEvents, key, state, runDelayed } = createScene('lobby')
  const opened = []
  uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  scene.player.x = 632; scene.player.y = 230
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 책 꺼내 보기')
  key._justDown = true; scene.update()
  assert.deepEqual(state.fx.calls.at(-1), ['intercept', 'bookshelf'])
  assert.deepEqual(opened, [], '연출이 끝나기 전에는 열지 않는다')
  assert.equal(scene.player.movementEnabled, false, '책을 받는 동안 멈춰 선다')
  runDelayed()
  assert.deepEqual(opened, ['bookshelf'])
})

test('모든 안내 문구는 다가간 뒤 2초만 보이고, 문구가 바뀌면 다시 보인다', () => {
  const { scene } = createScene('lobby')
  scene.player.x = 620; scene.player.y = 400
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 방명록')
  assert.equal(scene.interactionHint.visible, true)
  scene.time.now = 1999; scene.update()
  assert.equal(scene.interactionHint.visible, true)
  scene.time.now = 2000; scene.update()
  assert.equal(scene.interactionHint.visible, false, '2초 뒤 사라진다')
  scene.player.y = 480; scene.update()
  scene.player.y = 400; scene.update()
  assert.equal(scene.interactionHint.visible, true, '벗어났다 다시 다가가면 2초 동안 다시 보인다')
  scene.player.x = 445; scene.player.y = 240; scene.update()
  assert.equal(scene.interactionHint.text, 'E · 커피 마시기 · 2원')
  assert.equal(scene.interactionHint.visible, true, '다른 대상으로 옮기면 다시 보인다')
  scene.time.now += 2000; scene.update()
  assert.equal(scene.interactionHint.visible, false, '커피·식물 등 다른 안내도 2초 뒤 사라진다')
  scene.player.x = 400; scene.player.y = 530; scene.update()
  assert.equal(scene.interactionHint.text, 'E · 나가기')
  scene.time.now += 2000; scene.update()
  assert.equal(scene.interactionHint.visible, false, '출입구 안내도 2초 뒤 사라진다')
})

test('테이블 대화 안내는 2초 뒤 사라지고, E로 참여·나가기가 바뀌면 다시 2초 보인다', () => {
  const { scene, key } = createScene('meeting-room')
  scene.player.x = 400; scene.player.y = 420
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 테이블 대화 참여')
  scene.time.now = 2000; scene.update()
  assert.equal(scene.interactionHint.visible, false)
  key._justDown = true; scene.update()
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 테이블 대화 나가기')
  assert.equal(scene.interactionHint.visible, true, '문구가 바뀌면 다시 보인다')
  scene.time.now = 4000; scene.update()
  assert.equal(scene.interactionHint.visible, false)
})

test('사운드: 방 음악을 시작하고, 실제로 움직일 때만 발걸음, 패널·의자 소리를 낸다', () => {
  const lobby = createScene('lobby')
  assert.equal(lobby.state.rooms[0][0], 'lobby', '장면을 만들면 방 음악·환경음을 요청한다')
  lobby.scene.player.x = 400; lobby.scene.player.y = 400; lobby.scene.update()
  lobby.scene.update()
  assert.equal((lobby.state.sounds ?? []).filter(s => s.startsWith('footstep')).length, 0, '제자리면 발걸음 없음')
  lobby.scene.player.y = 398; lobby.scene.update()
  assert.equal(lobby.state.sounds.at(-1), 'footstep-carpet', '로비 카펫 위 발걸음')
  lobby.scene.player.x = 620; lobby.scene.player.y = 400; lobby.scene.update()
  lobby.key._justDown = true; lobby.scene.update()
  assert.deepEqual(lobby.state.sounds.slice(-2), ['panel-open', 'kiosk'], '키오스크 패널을 열 때')
  lobby.uiEvents.emit(PULLS_EVENTS.closePulls)
  assert.equal(lobby.state.sounds.at(-1), 'panel-close')

  const control = createScene('control-room')
  control.scene.player.x = 340; control.scene.player.y = 395; control.scene.update()
  control.key._justDown = true; control.scene.update()
  assert.equal(control.state.sounds.at(-1), 'chair-sit')
  control.key._justDown = true; control.scene.update()
  assert.equal(control.state.sounds.at(-1), 'chair-stand')
})

test('가방: I로 가방 창을 열고, 발밑 바닥 물고기는 E로 줍는다', () => {
  const { scene, uiEvents, key, state } = createScene('outdoor')
  const opened = []
  uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  scene.player.x = 200; scene.player.y = 450
  state.iKey._justDown = true; scene.update()
  assert.deepEqual(opened, ['inventory'])
  assert.equal(scene.player.movementEnabled !== undefined, true)
  scene.uiEvents.emit(LAB_EVENTS.closePanel)
  scene.drawGround([{ id: '00000000-0000-4000-8000-0000000000aa', kind: 'FISH', name: '붕어', sizeCm: 23, x: 210, y: 452 }])
  scene.update()
  assert.equal(scene.interactionHint.text, 'E · 붕어 23cm 줍기')
  key._justDown = true; scene.update()
  assert.deepEqual(state.picks, ['00000000-0000-4000-8000-0000000000aa'])
  scene.player.x = 400; scene.update()
  assert.equal(scene.interactionHint.visible, false, '멀어지면 줍기 대상이 아니다')
})

test('방명록: 로비 컴퓨터는 방명록 창을 열고, GitHub PR 목록은 개발 연구실 슈퍼컴퓨터에서 연다', () => {
  const lobby = createScene('lobby')
  const opened = []
  let research = 0
  lobby.uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  lobby.uiEvents.on(PULLS_EVENTS.openPulls, () => research++)
  lobby.scene.player.x = 620; lobby.scene.player.y = 400
  lobby.key._justDown = true; lobby.scene.update()
  assert.deepEqual(opened, ['guestbook'])
  assert.equal(research, 0, '로비에서는 PR 목록을 열지 않는다')

  const lab = createScene('development-lab')
  let labResearch = 0
  lab.uiEvents.on(PULLS_EVENTS.openPulls, () => labResearch++)
  lab.scene.player.x = 400; lab.scene.player.y = 290
  lab.scene.update()
  assert.equal(lab.scene.interactionHint.text, 'E · GitHub PR 목록')
  lab.key._justDown = true; lab.scene.update()
  assert.equal(labResearch, 1)
})

test('글 입력 칸에 포커스가 있으면 게임 키 가로채기를 꺼서 띄어쓰기가 입력되고, 벗어나면 다시 켠다', () => {
  const { scene, state } = createScene()
  scene.update()
  assert.equal(state.capture, true, '게임 중에는 Space·방향키가 페이지를 스크롤하지 않게 가로챈다')
  state.textFocused = true; scene.update()
  assert.equal(state.capture, false, '게시판·방명록 입력 중에는 Space를 막지 않는다')
  state.textFocused = false; scene.update()
  assert.equal(state.capture, true)
  state.textFocused = true; scene.update()
  scene.events.emit('shutdown')
  assert.equal(state.capture, true, '장면이 끝나면 원래대로 돌린다')
})

test('관리자실 문: 관리자가 아니면 열지 않고 안내만 하며, 관리자는 들어간다', () => {
  // 관리자실은 개발 연구실 오른쪽 위 문이다.
  const { scene, key, state } = createScene('development-lab')
  const door = ROOMS['development-lab'].doors.find(entry => entry.target === 'control-room')
  let admin = false
  const changes = []
  scene.client.canEnter = target => target !== 'control-room' || admin
  const changeRoom = scene.client.changeRoom
  scene.client.changeRoom = id => { changes.push(id); return changeRoom?.call(scene.client, id) ?? true }
  scene.tweens ??= { add() {} } // 안내 문구가 떠오르는 연출
  scene.player.x = door.x; scene.player.y = door.y
  key._justDown = true; scene.update()
  assert.deepEqual(changes, [], '관리자가 아니면 방 이동을 요청하지 않는다')
  assert.equal(state.sounds.at(-1), 'error')
  admin = true
  scene.time.now += 3000
  key._justDown = true; scene.update()
  assert.deepEqual(changes, [door.id])
})


test('왼쪽 자판기는 E로 구매 창을 열고 사무실 정수기는 방 연출에 전달된다', () => {
  const lobby = createScene('lobby'), opened = []
  lobby.uiEvents.on(LAB_EVENTS.openPanel, value => opened.push(value))
  lobby.scene.player.x = 168; lobby.scene.player.y = 245
  lobby.scene.update()
  assert.equal(lobby.scene.interactionHint.text, 'E · 음료 자판기')
  lobby.key._justDown = true; lobby.scene.update()
  assert.deepEqual(opened, ['vending-machine'])
  assert.equal(lobby.scene.player.movementEnabled, false)
  const office = createScene('office-1')
  office.state.fx.intercepting = true
  office.scene.player.x = 60; office.scene.player.y = 225
  office.scene.update()
  assert.equal(office.scene.interactionHint.text, 'E · 정수기 · 물 마시기')
  office.key._justDown = true; office.scene.update()
  assert.deepEqual(office.state.fx.calls.at(-1), ['intercept', 'water-dispenser'])
  assert.equal(office.scene.player.movementEnabled, true)
})

test('상호작용 대상: NPC와 의자가 둘 다 범위 안이면 더 가까운 쪽(내 자리 의자 앞에서 연구원이 잡히지 않게)', async () => {
  const { closerTarget } = await import('../src/game/interaction.ts')
  const npc = { id: 'npc', x: 230, y: 500, width: 24, height: 40 }
  const chair = { id: 'chair', x: 190, y: 516, width: 28, height: 24 }
  assert.equal(closerTarget(190, 530, npc, chair).id, 'chair')
  assert.equal(closerTarget(232, 500, npc, chair).id, 'npc')
  assert.equal(closerTarget(190, 530, undefined, chair).id, 'chair')
  assert.equal(closerTarget(190, 530, npc, undefined).id, 'npc')
})
