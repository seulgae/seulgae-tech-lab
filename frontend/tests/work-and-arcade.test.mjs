import assert from 'node:assert/strict'
import test from 'node:test'
import { BREAKOUT_HIGH_SCORE_KEY, FIELD, PADDLE, brickScore, createBricks, newGame, stepBreakout } from '../src/features/arcade/breakout.ts'
import { OFFICE_BOARDS, addMaintenance, addOperation, codeName, createQa, fetchBoard } from '../src/features/work/workApi.ts'
import { ROOMS, nearestInteraction } from '../src/game/maps/rooms.ts'

const idle = { left: false, right: false, pointerX: null, launch: false }

test('사무실 게시판 배치: 1번 QA, 2번 유지보수, 4번 운영업무, 3번은 오락실', () => {
  assert.deepEqual(OFFICE_BOARDS, { 'office-1': 'QA', 'office-2': 'MAINTENANCE', 'office-4': 'OPERATION' })
  for (const room of ['office-1', 'office-2', 'office-4']) assert.equal(nearestInteraction(room, 400, 290)?.kind, 'work-board', room)
  assert.equal(ROOMS['office-3'].name, '3번 오락실')
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
