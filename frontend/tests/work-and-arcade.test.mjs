import assert from 'node:assert/strict'
import test from 'node:test'
import { BREAKOUT_HIGH_SCORE_KEY, FIELD, PADDLE, brickScore, createBricks, newGame, stepBreakout } from '../src/features/arcade/breakout.ts'
import { WORK_BOARDS, addMaintenance, addOperation, codeName, createQa, fetchBoard } from '../src/features/work/workApi.ts'
import { ROOMS, nearestInteraction, roomObjects } from '../src/game/maps/rooms.ts'

const idle = { left: false, right: false, pointerX: null, launch: false }

test('서비스 연구실은 좌우 두 열에 책상 셋씩(책상마다 의자, 줄 사이 파티션), 2번은 뭘 만들까(빈 방)·4번은 뭘만들지, 오락실은 로비에', () => {
  const objects = roomObjects('office-1')
  assert.deepEqual([...new Set(objects.map(object => object.texture))].sort(), ['chair', 'computer', 'partition'], '화분·책장·입구 작업대는 치웠다')
  const desks = objects.filter(object => object.texture === 'computer'), chairs = objects.filter(object => object.texture === 'chair')
  assert.equal(desks.length, 6); assert.equal(chairs.length, 6, '아래 줄 책상에도 의자')
  for (const desk of desks) assert.ok(chairs.some(chair => chair.x === desk.x && chair.bottom > desk.bottom && chair.bottom - desk.bottom < 60), `책상 (${desk.x}, ${desk.bottom}) 아래 의자`)
  assert.ok(objects.every(object => object.body.y + object.body.height / 2 <= 576), '아래 벽(576) 안쪽')
  // 좌우 작업석 사이 중앙 통로(x 280~520)는 비워 둔다.
  assert.ok(objects.every(object => object.body.x + object.body.width / 2 <= 280 || object.body.x - object.body.width / 2 >= 520), '가운데 직원 통로와 문 앞은 비워 둔다')
  const partitions = objects.filter(object => object.texture === 'partition')
  assert.equal(partitions.length, 6, '책상마다 통로 쪽 파티션')
  for (const partition of partitions) assert.ok(chairs.every(chair => partition.body.y + partition.body.height / 2 < chair.body.y - chair.body.height / 2 || partition.body.y - partition.body.height / 2 > chair.body.y + chair.body.height / 2 || Math.abs(partition.x - chair.x) > 40), '의자 줄은 통로에서 들어갈 수 있게 열어 둔다')
  assert.equal(ROOMS['office-1'].name, '서비스 연구실')
  assert.deepEqual(WORK_BOARDS, { 'service-qa': 'QA', 'service-maintenance': 'MAINTENANCE', 'service-operation': 'OPERATION' })
  // 왼쪽 열 위에서부터 QA·유지보수·운영(책상 바로 아래 의자 옆에 서면 잡힌다)
  for (const [y, id] of [[210, 'service-qa'], [360, 'service-maintenance'], [510, 'service-operation']]) {
    const target = nearestInteraction('office-1', 145, y)
    assert.equal(target?.kind, 'work-board'); assert.equal(target?.id, id, '컴퓨터마다 자기 게시판')
  }
  assert.equal(ROOMS['office-2'].name, '뭘 만들까')
  assert.equal(ROOMS['office-4'].name, '뭘만들지')
  for (const room of ['office-2', 'office-4']) {
    assert.equal(ROOMS[room].interactions.length, 0, room)
  }
  assert.equal(ROOMS['office-3'].name, '오락실')
  assert.deepEqual(ROOMS.lobby.doors.find(door => door.target === 'office-3') && [ROOMS.lobby.doors.find(door => door.target === 'office-3').x, ROOMS.lobby.doors.find(door => door.target === 'office-3').y], [70, 520], '오락실은 로비 왼쪽 아래 문')
  assert.equal(ROOMS['office-3'].doors[0].target, 'lobby')
  assert.equal(nearestInteraction('office-3', 400, 290)?.kind, 'arcade')
  assert.equal(codeName([{ group: 'WORK_STATUS', code: 'RESOLVED', name: '조치 완료', sortOrder: 3 }], 'RESOLVED'), '조치 완료')
  assert.equal(codeName([], 'APPROVED'), 'APPROVED')
})

test('업무 API 요청 형식: 게시판 조회, QA 등록, 조치(완료 여부), 점검(승인 여부)', async () => {
  const original = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url, options = {}) => { seen.push([url, options.method ?? 'GET', options.body && JSON.parse(options.body)]); return new Response('{}', { headers: { 'Content-Type': 'application/json' } }) }
  try {
    await fetchBoard('MAINTENANCE')
    await createQa('제목', '내용')
    await addMaintenance('a/b', '조치', '가이드', true)
    await addOperation('a/b', '점검', false)
    assert.deepEqual(seen, [
      ['/api/work-items?board=MAINTENANCE', 'GET', undefined],
      ['/api/work-items/qa', 'POST', { title: '제목', content: '내용' }],
      ['/api/work-items/a%2Fb/maintenance', 'POST', { content: '조치', guide: '가이드', done: true }],
      ['/api/work-items/a%2Fb/operation', 'POST', { content: '점검', approved: false }],
    ])
    globalThis.fetch = async () => new Response('', { status: 409 })
    await assert.rejects(addOperation('x', '점검', true), error => error.status === 409)
  } finally { globalThis.fetch = original }
})

test('벽돌 부수기: 발사 전 공은 패들 위, 벽·패들 반사, 벽돌 점수, 공을 놓치면 목숨 감소', () => {
  assert.equal(createBricks().length, 60)
  assert.equal(brickScore(0), 60); assert.equal(brickScore(5), 10)
  assert.equal(BREAKOUT_HIGH_SCORE_KEY, 'seulgae.arcade.breakout')
  let game = newGame()
  game = stepBreakout(game, 0.016, { ...idle, right: true }).state
  assert.equal(game.ball.x, game.paddleX + PADDLE.width / 2, '발사 전에는 패들을 따라간다')
  game = stepBreakout(game, 0.016, { ...idle, launch: true }).state
  assert.equal(game.phase, 'playing'); assert.ok(game.ball.vy < 0)
  // 왼쪽 벽 반사
  let r = stepBreakout({ ...game, ball: { x: 2, y: 150, vx: -100, vy: -50 } }, 0.016, idle)
  assert.ok(r.state.ball.vx > 0 && r.events.includes('wall'))
  // 패들 가운데에 맞으면 위로 곧게
  r = stepBreakout({ ...game, paddleX: 100, ball: { x: 126, y: PADDLE.y - 4, vx: 0, vy: 150 } }, 0.016, idle)
  assert.ok(r.events.includes('paddle') && r.state.ball.vy < 0 && Math.abs(r.state.ball.vx) < 1)
  // 맨 윗줄 벽돌을 깨면 60점
  const top = game.bricks[0]
  r = stepBreakout({ ...game, ball: { x: top.x + 5, y: top.y + 12, vx: 0, vy: -150 } }, 0.016, idle)
  assert.ok(r.events.includes('brick')); assert.equal(r.state.score, 60); assert.equal(r.state.bricks.filter(b => !b.alive).length, 1)
  // 공을 놓치면 목숨이 줄고 다시 발사 대기
  r = stepBreakout({ ...game, ball: { x: 50, y: FIELD.height + 10, vx: 0, vy: 150 } }, 0.016, idle)
  assert.equal(r.state.lives, 2); assert.equal(r.state.phase, 'ready'); assert.ok(r.events.includes('lose'))
  r = stepBreakout({ ...game, lives: 1, ball: { x: 50, y: FIELD.height + 10, vx: 0, vy: 150 } }, 0.016, idle)
  assert.equal(r.state.phase, 'over'); assert.ok(r.events.includes('over'))
  assert.equal(stepBreakout(r.state, 0.016, { ...idle, launch: true }).state.lives, 3, '게임 오버 뒤 발사하면 새 게임')
})

test('벽돌 부수기: 마지막 벽돌을 깨면 클리어, 다음 판은 점수 유지·더 빠른 공', () => {
  const game = newGame()
  const last = game.bricks[59]
  const bricks = game.bricks.map((brick, index) => ({ ...brick, alive: index === 59 }))
  const r = stepBreakout({ ...game, phase: 'playing', bricks, ball: { x: last.x + 5, y: last.y + 12, vx: 0, vy: -150 } }, 0.016, idle)
  assert.equal(r.state.phase, 'clear'); assert.ok(r.events.includes('clear'))
  const next = stepBreakout(r.state, 0.016, { ...idle, launch: true }).state
  assert.equal(next.level, 2); assert.equal(next.score, r.state.score); assert.equal(next.bricks.length, 60)
  const launched = stepBreakout(next, 0.016, { ...idle, launch: true }).state
  assert.ok(Math.hypot(launched.ball.vx, launched.ball.vy) > 150 * 1.1, '레벨이 오르면 공이 빨라진다')
})
