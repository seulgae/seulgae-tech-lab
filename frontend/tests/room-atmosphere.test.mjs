import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOMS, roomObjects } from '../src/game/maps/rooms.ts'
import { ROOM_THEMES, floorData } from '../src/game/rooms/roomThemes.ts'
import { createRoomAssets } from '../src/game/assets/roomAssets.ts'
import {
  ALERT_AUTO_RESOLVE_MS, CiPipeline, LOBBY_ANNOUNCEMENTS, ServerAlert, detectArrivals, nextDelay, rotate,
} from '../src/game/rooms/roomEventLogic.ts'

const COLOR = /^#[0-9a-f]{6}$/

test('네 방 모두 고유한 분위기 팔레트와 페이지 색, 안내 문구를 갖는다', () => {
  assert.deepEqual(Object.keys(ROOM_THEMES).sort(), Object.keys(ROOMS).sort())
  for (const [id, theme] of Object.entries(ROOM_THEMES)) {
    for (const group of [theme.floor, theme.wall, theme.door, theme.page]) for (const value of Object.values(group)) assert.match(value, COLOR, id)
    assert.match(theme.camera, COLOR); assert.match(theme.light, COLOR)
    assert.ok(theme.notes.title && theme.notes.mission, id)
  }
  const accents = new Set(Object.values(ROOM_THEMES).map(theme => theme.page.accent))
  assert.equal(accents.size, 4, '방마다 강조색이 달라야 한다')
})

test('방별 바닥은 25×19로 화면을 덮고, 강조 타일이 각 방의 동선을 표시한다', () => {
  for (const id of Object.keys(ROOMS)) {
    const data = floorData(id)
    assert.equal(data.length, 19)
    for (const row of data) { assert.equal(row.length, 25); assert.ok(row.every(i => i >= 0 && i < 3)) }
    assert.ok(data.flat().includes(2), `${id}: 강조 타일`)
  }
  // 로비 레드 카펫은 정문(아래 중앙)부터 안내 데스크 앞까지 이어진다.
  const lobby = floorData('lobby')
  for (let row = 7; row < 19; row++) assert.equal(lobby[row][12], 2)
  assert.notEqual(lobby[3][12], 2)
})

test('가구 교체 텍스처는 모두 등록되고 정수 좌표로 캔버스 안에만 그린다', () => {
  const originalDocument = globalThis.document
  const textures = new Map()
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({
      fillRect(x, y, width, height) {
        assert.ok([x, y, width, height].every(Number.isInteger))
        assert.ok(x >= 0 && y >= 0 && x + width <= canvas.width && y + height <= canvas.height, `${x},${y},${width},${height} in ${canvas.width}x${canvas.height}`)
      },
    }) }
    return canvas
  } }
  try {
    const scene = { textures: { exists: key => textures.has(key), addCanvas: (key, canvas) => textures.set(key, canvas) } }
    createRoomAssets(scene)
    const size = textures.size
    createRoomAssets(scene)
    assert.equal(textures.size, size, '중복 생성하지 않는다')
    for (const [id, theme] of Object.entries(ROOM_THEMES)) {
      for (const key of [`floor-${id}`, `wall-${id}`, `door-frame-${id}`, `door-panel-${id}`]) assert.ok(textures.has(key), key)
      for (const object of roomObjects(id)) {
        const replacement = theme.textures[object.texture]
        if (replacement) assert.ok(textures.has(replacement), `${id}: ${replacement}`)
      }
    }
    // 교체 텍스처는 원래 가구와 같은 크기여서 충돌 영역과 겉모습이 어긋나지 않는다.
    const sizes = { reception: [104, 48], computer: [64, 64], chair: [20, 28], rack: [32, 64], equipment: [56, 48], plant: [24, 40] }
    for (const theme of Object.values(ROOM_THEMES)) for (const [original, replacement] of Object.entries(theme.textures)) {
      const canvas = textures.get(replacement)
      assert.deepEqual([canvas.width, canvas.height], sizes[original], replacement)
    }
  } finally {
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})

test('이벤트 간격·순환 문구·도착 감지 규칙', () => {
  assert.equal(nextDelay(1000, 2000, () => 0), 1000)
  assert.equal(nextDelay(1000, 2000, () => 1), 2000)
  assert.equal(nextDelay(1000, 2000, () => 7), 2000)
  assert.equal(rotate(LOBBY_ANNOUNCEMENTS, LOBBY_ANNOUNCEMENTS.length), LOBBY_ANNOUNCEMENTS[0])
  assert.equal(rotate(LOBBY_ANNOUNCEMENTS, -1), LOBBY_ANNOUNCEMENTS.at(-1))
  const a = { id: 'a', nickname: '나' }, b = { id: 'b', nickname: '손님' }
  assert.deepEqual(detectArrivals(null, [a, b], 'a'), [], '첫 스냅샷의 기존 인원은 환영하지 않는다')
  assert.deepEqual(detectArrivals(new Set(['a']), [a, b], 'a'), [b])
  assert.deepEqual(detectArrivals(new Set(['b']), [a, b], 'a'), [], '본인은 제외한다')
})

test('CI 빌드는 번호가 증가하고 실패하면 실패한 테스트 수를 알려 준다', () => {
  const pipeline = new CiPipeline(10)
  const passed = pipeline.next(() => 0.9)
  assert.deepEqual([passed.number, passed.passed, passed.failedTests], [11, true, 0])
  const failed = pipeline.next(() => 0.1)
  assert.equal(failed.number, 12); assert.equal(failed.passed, false)
  assert.ok(failed.failedTests >= 1 && failed.failedTests <= 3)
})

test('서버실 경보는 한 번에 하나만 울리고 수동 또는 자동으로 해제된다', () => {
  const alert = new ServerAlert()
  assert.equal(alert.resolve(), null)
  assert.equal(alert.trigger(1000, 'R-02'), true)
  assert.equal(alert.trigger(1500, 'R-03'), false)
  assert.equal(alert.update(1000 + ALERT_AUTO_RESOLVE_MS - 1), null)
  assert.equal(alert.resolve(), 'manual')
  assert.equal(alert.state.active, false)
  alert.trigger(5000, 'R-01')
  assert.equal(alert.update(5000 + ALERT_AUTO_RESOLVE_MS), 'auto')
  assert.equal(alert.update(99999), null)
})
