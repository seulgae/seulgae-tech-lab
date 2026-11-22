import assert from 'node:assert/strict'
import test from 'node:test'
import { nearestInteraction, roomObstacles, roomProps } from '../src/game/maps/rooms.ts'
import { TREAT_STORAGE_KEY, countTreat, localDay, treatMessage } from '../src/game/rooms/roomEventLogic.ts'
import { TECH_BOOKS } from '../src/features/books/techBooks.ts'

test('로비에만 케이크·커피·오른쪽 책장 한 개가 있고 다른 방에는 없다', () => {
  assert.deepEqual(roomProps('lobby').map(prop => prop.id), ['lobby-cake', 'lobby-coffee', 'lobby-bookshelf-0'])
  for (const room of ['development-lab', 'server-room', 'meeting-room']) assert.deepEqual(roomProps(room), [])
})

test('데스크 앞에서는 커피·케이크, 책장 앞에서는 책장, 키오스크는 그대로 고른다', () => {
  assert.equal(nearestInteraction('lobby', 445, 240)?.kind, 'coffee')
  assert.equal(nearestInteraction('lobby', 355, 240)?.kind, 'cake')
  assert.equal(nearestInteraction('lobby', 112, 245)?.kind, 'vending-machine')
  assert.equal(nearestInteraction('lobby', 688, 230)?.id, 'lobby-bookshelf-0')
  assert.equal(nearestInteraction('lobby', 620, 400)?.kind, 'guestbook')
  assert.equal(nearestInteraction('lobby', 66, 150)?.kind, 'plant', '책장 위쪽 화분 옆에서는 화분이 대상이다')
})

test('케이크·커피 소품은 새 충돌 영역을 만들지 않는다', () => {
  const before = roomObstacles('lobby').length
  roomProps('lobby')
  assert.equal(roomObstacles('lobby').length, before)
})

test('먹고 마신 횟수는 하루 단위로 세고 깨진 기록·지난 날짜는 처음부터 센다', () => {
  assert.equal(TREAT_STORAGE_KEY, 'seulgae.lobby.treats')
  const first = countTreat(null, 'coffee', '2026-11-17')
  assert.deepEqual(first, { date: '2026-11-17', coffee: 1, cake: 0 })
  const second = countTreat(JSON.stringify(first), 'coffee', '2026-11-17')
  assert.equal(second.coffee, 2)
  assert.deepEqual(countTreat(JSON.stringify(second), 'cake', '2026-11-17'), { date: '2026-11-17', coffee: 2, cake: 1 })
  assert.deepEqual(countTreat(JSON.stringify(second), 'cake', '2026-11-18'), { date: '2026-11-18', coffee: 0, cake: 1 })
  assert.deepEqual(countTreat('{broken', 'coffee', '2026-11-17'), first)
  assert.deepEqual(countTreat('{"date":"2026-11-17","coffee":-3,"cake":"9"}', 'coffee', '2026-11-17'), first)
  assert.equal(countTreat('{"date":"2026-11-17","coffee":99,"cake":0}', 'coffee', '2026-11-17').coffee, 99)
})

test('배너 문구와 로컬 날짜', () => {
  assert.equal(treatMessage('coffee', 1), '오늘 첫 커피! 집중력이 올라가요')
  assert.equal(treatMessage('coffee', 3), '오늘 커피 3잔째')
  assert.match(treatMessage('coffee', 4), /물도 한 잔/)
  assert.equal(treatMessage('cake', 2), '오늘 케이크 2조각째')
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
})

test('책장 기술 노트는 id가 겹치지 않고 모든 쪽에 제목과 짧은 본문이 있다', () => {
  assert.ok(TECH_BOOKS.length >= 3)
  assert.equal(new Set(TECH_BOOKS.map(book => book.id)).size, TECH_BOOKS.length)
  for (const book of TECH_BOOKS) {
    assert.match(book.color, /^#[0-9a-f]{6}$/)
    assert.ok(book.pages.length >= 2, book.id)
    for (const page of book.pages) {
      assert.ok(page.heading.length > 0 && page.heading.length <= 20, page.heading)
      assert.ok(page.body.length > 0 && page.body.every(paragraph => paragraph.length <= 80), page.heading)
    }
  }
  // 책에 운영 정보(주소·계정)를 적지 않는다.
  assert.doesNotMatch(JSON.stringify(TECH_BOOKS), /\d+\.\d+\.\d+\.\d+|ts\.net|password|stlab_/i)
})
