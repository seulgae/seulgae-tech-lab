import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOMS, doorHint, doorLabel, nearestInteraction, roomObjects, roomObstacles, roomSeats } from '../src/game/maps/rooms.ts'
import { parseServerMessage } from '../src/features/multiplayer/model/protocol.ts'
import {
  FISH, FISH_LOG_KEY, catchMessage, catchZone, inZone, needleAt, recordCatch, rollCatch, waitBeforeBite,
} from '../src/game/rooms/fishingLogic.ts'
import { setRoomObstacles, constrainedPosition } from '../src/game/multiplayer/networkPosition.ts'

const player = (id, x = 400, y = 400) => ({ id, nickname: '연구원', x, y, facing: 'down', moving: false, ack: 1 })
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('로비 문 배치: 왼쪽 위 개발 연구실, 오른쪽 위 실습 연구실, 왼쪽 아래 오락실, 오른쪽 아래 뭘만들지, 아래 가운데 나가기', () => {
  const doors = Object.fromEntries(ROOMS.lobby.doors.map(door => [door.target, [door.x, door.y]]))
  assert.deepEqual(doors, { 'development-lab': [70, 250], 'office-2': [730, 250], 'office-3': [70, 520], 'office-4': [730, 520], outdoor: [400, 540] })
  const exit = ROOMS.lobby.doors.find(door => door.target === 'outdoor')
  assert.equal(doorLabel(exit), '나가기')
  assert.equal(doorHint(exit), 'E · 나가기')
  assert.equal(doorHint(ROOMS.lobby.doors[0]), 'E · 개발 연구실 입장')
})

test('로비 소파·의자와 개발 연구실 화분을 치웠고, 책장은 옆문과 겹치지 않게 안쪽에 있다', () => {
  const lobby = roomObjects('lobby').map(object => object.texture)
  assert.ok(!lobby.includes('chair') && !lobby.includes('equipment'))
  assert.deepEqual(roomSeats('lobby'), [])
  assert.ok(!roomObjects('development-lab').some(object => object.texture === 'plant'))
  for (const rack of roomObjects('lobby').filter(object => object.texture === 'rack')) {
    for (const door of ROOMS.lobby.doors) assert.ok(Math.abs(rack.x - door.x) >= 90 || door.y > 400, `${rack.x}: ${door.id}`)
  }
})

test('관리자실: 슈퍼컴퓨터 한 대(쿼리 콘솔)와 의자 두 개, CCTV 모니터는 없다', () => {
  assert.equal(ROOMS['control-room'].name, '관리자실')
  // 관리자실은 개발 연구실 오른쪽 위 문, 그 앞에 작은 관리자 신청 컴퓨터가 있다.
  const adminDoor = ROOMS['development-lab'].doors.find(door => door.target === 'control-room')
  assert.deepEqual([adminDoor.x, adminDoor.y], [730, 250])
  assert.equal(doorHint(adminDoor), 'E · 관리자실 입장')
  assert.equal(ROOMS['control-room'].doors[0].target, 'development-lab')
  assert.equal(nearestInteraction('development-lab', 650, 325)?.kind, 'admin-apply')
  assert.ok(Math.hypot(650 - adminDoor.x, 325 - adminDoor.y) > 56, '신청 컴퓨터 앞은 문 범위 밖이다')
  assert.equal(roomSeats('control-room').length, 2)
  assert.deepEqual(roomObjects('control-room').filter(object => object.texture === 'supercomputer').length, 1)
  assert.ok(!roomObjects('control-room').some(object => object.texture === 'monitor-wall'))
  assert.equal(nearestInteraction('control-room', 400, 280)?.kind, 'admin-console')
})

test('상태 메시지의 feeds는 알려진 방·정원 이하·중복 없는 참가자만 받는다', () => {
  const state = feeds => JSON.stringify({ type: 'state', tick: 3, players: [player(id(1))], feeds })
  const ok = parseServerMessage(state({ lobby: [player(id(1))], outdoor: [player(id(2), 650, 470)], 'control-room': [] }))
  assert.equal(ok.feeds.outdoor[0].x, 650)
  assert.equal(parseServerMessage(JSON.stringify({ type: 'state', tick: 4, players: [] })).feeds, undefined, 'feeds는 관제실에서만 온다')
  assert.throws(() => parseServerMessage(state({ basement: [] })), /feeds/)
  assert.throws(() => parseServerMessage(state({ lobby: [player(id(1))], outdoor: [player(id(1))] })), /feeds/)
  assert.throws(() => parseServerMessage(state({ lobby: Array.from({ length: 6 }, (_, i) => player(id(i + 1))) })), /feeds/)
  assert.throws(() => parseServerMessage(state([])), /feeds/)
})

test('바깥: 호수와 강은 들어갈 수 없고, 다리로 강을 건널 수 있으며, 데크에서 낚시한다', () => {
  const water = roomObjects('outdoor').filter(object => object.texture === 'lake' || object.texture === 'river')
  assert.equal(water.length, 3)
  setRoomObstacles(roomObstacles('outdoor'))
  // 호수 오른쪽에서 왼쪽으로 걸으면 호숫가에 막힌다.
  assert.ok(constrainedPosition(350, 260, -40, 0).x >= 330 + 10)
  // 강 북쪽은 막히고, 다리 높이(y 360)에서는 건너간다.
  assert.ok(constrainedPosition(620, 200, 40, 0).x <= 640 - 10)
  assert.ok(constrainedPosition(620, 370, 100, 0).x > 700)
  assert.equal(nearestInteraction('outdoor', 612, 250)?.kind, 'fishing')
  assert.equal(nearestInteraction('outdoor', 400, 460), undefined, '스폰에서는 아무 상호작용도 잡히지 않는다')
  setRoomObstacles(roomObstacles('lobby'))
})

test('낚시: 입질 대기, 시간대별 어종, 크기 범위, 게이지와 바늘', () => {
  assert.equal(waitBeforeBite(() => 0), 1500)
  assert.equal(waitBeforeBite(() => 1), 5000)
  const night = rollCatch('evening', () => 0.999)
  assert.ok(FISH.some(fish => fish.id === night.species.id))
  for (let i = 0; i < 200; i++) {
    const r = Math.random
    const caught = rollCatch('noon', r)
    assert.ok(caught.cm >= caught.species.minCm && caught.cm <= caught.species.maxCm)
    assert.ok(!caught.species.phases || caught.species.phases.includes('noon'), caught.species.name)
  }
  assert.equal(rollCatch('noon', () => 0).species.id, 'minnow')
  const zone = catchZone('legendary', () => 1)
  assert.ok(zone.start + zone.width <= 0.95 && zone.width < catchZone('common', () => 0).width)
  assert.equal(needleAt(0, 'common'), 0)
  assert.ok(Math.abs(needleAt(1250, 'common') - 1) < 1e-9, '끝까지 갔다가')
  assert.ok(Math.abs(needleAt(2500, 'common')) < 1e-9, '되돌아온다')
  assert.equal(inZone(0.5, { start: 0.4, width: 0.2 }), true)
  assert.equal(inZone(0.7, { start: 0.4, width: 0.2 }), false)
})

test('낚시 기록: 오늘 마릿수는 날짜별, 종류별 최대 크기와 신기록, 깨진 기록은 버린다', () => {
  assert.equal(FISH_LOG_KEY, 'seulgae.outdoor.fishlog')
  const crucian = FISH.find(fish => fish.id === 'crucian')
  const first = recordCatch(null, { species: crucian, cm: 20 }, '2026-11-17')
  assert.deepEqual(first.log, { date: '2026-11-17', today: 1, total: 1, best: { crucian: 20 } })
  assert.equal(first.record, false, '첫 기록은 신기록 표시를 하지 않는다')
  const bigger = recordCatch(JSON.stringify(first.log), { species: crucian, cm: 28 }, '2026-11-17')
  assert.equal(bigger.record, true)
  assert.equal(bigger.log.today, 2)
  const nextDay = recordCatch(JSON.stringify(bigger.log), { species: crucian, cm: 10 }, '2026-11-18')
  assert.deepEqual([nextDay.log.today, nextDay.log.total, nextDay.log.best.crucian], [1, 3, 28])
  assert.deepEqual(recordCatch('{broken', { species: crucian, cm: 20 }, '2026-11-17').log, first.log)
  assert.match(catchMessage({ species: crucian, cm: 28 }, bigger.log, true), /신기록! 붕어 28cm/)
  assert.match(catchMessage({ species: crucian, cm: 20 }, first.log, false), /오늘 1마리/)
})
