import assert from 'node:assert/strict'
import test from 'node:test'
import { SKY_LABELS, SKY_PALETTES, SKY_PHASES, clockAngles, clockLabel, skyPhase } from '../src/game/rooms/timeOfDay.ts'
import { nearestInteraction, roomPlants, roomSeats, seatById } from '../src/game/maps/rooms.ts'
import { parseServerMessage } from '../src/features/multiplayer/model/protocol.ts'
import {
  AGENDA_CONTENT_MAX, AGENDA_TITLE_MAX, BoardError, IDEA_CONTENT_MAX, countChars, createAgenda, deleteAgenda, editToken, ideaTitle, rememberToken, updateAgenda,
} from '../src/features/boards/boardsApi.ts'

const at = (hour, minute = 0) => new Date(2026, 10, 16, hour, minute)

test('창밖 하늘은 새벽·이른 아침·아침·점심·노을·저녁 여섯 시간대로 바뀐다', () => {
  assert.deepEqual([0, 4, 5, 7, 8, 10, 11, 15, 16, 18, 19, 23].map(hour => skyPhase(at(hour))),
    ['dawn', 'dawn', 'early-morning', 'early-morning', 'morning', 'morning', 'noon', 'noon', 'sunset', 'sunset', 'evening', 'evening'])
  assert.equal(skyPhase(at(4, 59)), 'dawn')
  assert.deepEqual(SKY_PHASES.map(phase => SKY_LABELS[phase]), ['새벽', '이른 아침', '아침', '점심', '노을', '저녁'])
  for (const phase of SKY_PHASES) {
    const palette = SKY_PALETTES[phase]
    assert.ok(palette.sun || palette.moon, `${phase}: 해 또는 달`)
    assert.ok(palette.indoor > 0 && palette.lightAlpha > 0)
  }
  assert.ok(SKY_PALETTES.evening.indoor > SKY_PALETTES.noon.indoor, '밤에는 실내등이 더 밝다')
})

test('벽시계는 현재 시각의 바늘 각도와 HH:MM을 보여 준다', () => {
  const quarterPastThree = clockAngles(new Date(2026, 10, 16, 15, 15, 30))
  assert.ok(Math.abs(quarterPastThree.minute - (15.5 / 60) * Math.PI * 2) < 1e-9)
  assert.ok(Math.abs(quarterPastThree.hour - ((3 + 15.5 / 60) / 12) * Math.PI * 2) < 1e-9)
  assert.ok(Math.abs(quarterPastThree.second - Math.PI) < 1e-9)
  assert.equal(clockLabel(new Date(2026, 10, 16, 9, 5)), '09:05')
  assert.equal(clockLabel(new Date(2026, 10, 16, 23, 59)), '23:59')
})

test('의자 id는 서버와 같은 규칙이고, 의자 뒤에서 다가갈 때만 앉기 대상이다', () => {
  assert.deepEqual(roomSeats('lobby'), [], '로비 의자는 모두 치웠다')
  assert.deepEqual(roomSeats('control-room').map(seat => [seat.id, seat.x, seat.y]), [['control-room-chair-0', 340, 358], ['control-room-chair-1', 460, 358]])
  assert.equal(roomSeats('meeting-room').length, 3)
  assert.equal(roomSeats('server-room').length, 0)
  assert.equal(seatById('meeting-room-chair-2').x, 500)
  assert.equal(seatById('nope'), undefined)
  assert.equal(nearestInteraction('lobby', 620, 400)?.kind, 'research', '책상과 의자 사이에서는 컴퓨터')
  assert.equal(nearestInteraction('control-room', 340, 395)?.id, 'control-room-chair-0')
  assert.equal(nearestInteraction('meeting-room', 400, 385)?.id, 'meeting-room-chair-1')
  assert.equal(nearestInteraction('meeting-room', 350, 340)?.kind, 'table-talk')
  assert.equal(nearestInteraction('meeting-room', 400, 196)?.kind, 'agenda')
  assert.equal(roomPlants('lobby').length, 1)
  assert.equal(nearestInteraction('meeting-room', 100, 190)?.kind, 'plant')
})

test('서버 상태의 seat는 의자 id 또는 null만 받는다', () => {
  const player = { id: '00000000-0000-4000-8000-000000000001', nickname: '연구원', x: 400, y: 400, facing: 'up', moving: false, ack: 3 }
  const state = seat => JSON.stringify({ type: 'state', tick: 1, players: [{ ...player, seat }] })
  assert.equal(parseServerMessage(state('lobby-chair-0')).players[0].seat, 'lobby-chair-0')
  assert.equal(parseServerMessage(state(null)).players[0].seat, null)
  assert.equal(parseServerMessage(JSON.stringify({ type: 'state', tick: 1, players: [player] })).players[0].seat, undefined)
  assert.throws(() => parseServerMessage(state('<script>')))
})

test('글자 수는 이모지도 1자로 세고, 제목·내용 한도는 서버와 같다', () => {
  assert.equal(countChars('  👍한글 '), 3)
  assert.equal(countChars('a\r\nb'), 3)
  assert.equal(AGENDA_TITLE_MAX, 8)
  assert.equal(AGENDA_CONTENT_MAX, 130)
  assert.equal(IDEA_CONTENT_MAX, 130)
  assert.equal(ideaTitle(12), '연구 아이디어 일지 #12')
  assert.match(new BoardError(429).message, /잠시 후/)
  assert.match(new BoardError(403).message, /내가 쓴 글/)
})

test('수정 키는 이 브라우저에만 저장되고, 수정·삭제 요청에 헤더로 실린다', async t => {
  const memory = new Map()
  const store = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  const original = { localStorage: globalThis.localStorage, fetch: globalThis.fetch }
  const calls = []
  globalThis.localStorage = store
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET', token: init.headers['X-Edit-Token'], body: init.body && JSON.parse(init.body) })
    if (init.method === 'POST') return new Response(JSON.stringify({ agenda: { id: 'a1', title: '분위기', content: '내용', createdAt: '', updatedAt: null }, editToken: 'T'.repeat(43) }), { status: 201 })
    if (init.method === 'DELETE') return new Response(null, { status: 204 })
    if (url.endsWith('/forbidden')) return new Response('{}', { status: 403 })
    return new Response(JSON.stringify({ id: 'a1', title: '회고', content: '바뀐 내용', createdAt: '', updatedAt: '' }), { status: 200 })
  }
  t.after(() => Object.assign(globalThis, original))
  await createAgenda('분위기', '내용')
  assert.equal(editToken('a1', store), 'T'.repeat(43))
  await updateAgenda('a1', '회고', '바뀐 내용')
  assert.equal(calls.at(-1).token, 'T'.repeat(43))
  assert.deepEqual(calls.at(-1).body, { title: '회고', content: '바뀐 내용' })
  await deleteAgenda('a1')
  assert.equal(calls.at(-1).method, 'DELETE')
  assert.equal(editToken('a1', store), undefined, '삭제하면 키도 지운다')
  rememberToken('forbidden', 'x', store)
  await assert.rejects(updateAgenda('forbidden', 'a', 'b'), error => error instanceof BoardError && error.status === 403)
})
