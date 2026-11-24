import assert from 'node:assert/strict'
import test from 'node:test'
import { BREAKOUT_HIGH_SCORE_KEY, FIELD, PADDLE, brickScore, createBricks, newGame, stepBreakout } from '../src/features/arcade/breakout.ts'
import { OFFICE_COMPUTERS, QA_NEXT, answerJava, claimDailyReward, createIdea, createQa, fetchQa, javaString, moveQa } from '../src/features/office/officeApi.ts'
import { ROOMS, nearestInteraction, roomObjects } from '../src/game/maps/rooms.ts'

const idle = { left: false, right: false, pointerX: null, launch: false }

test('서비스 연구실은 좌우 두 열에 책상 셋씩(책상마다 의자, 줄 사이 파티션), 2번은 협동 연구실(빈 방)·4번은 개인 기숙사, 오락실은 로비에', () => {
  const objects = roomObjects('office-1')
  assert.deepEqual([...new Set(objects.map(object => object.texture))].sort(), ['chair', 'computer', 'partition', 'plant', 'water-dispenser'], '책상과 구석 휴게 소품만 배치한다')
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
  // 왼쪽 맨 아래만 내 자리 컴퓨터(아이디어·QA 게시판은 그 바탕화면 아이콘), 나머지 자리는 연구원들이 일한다.
  assert.deepEqual(ROOMS['office-1'].interactions.map(item => item.id), ['service-my-desk', 'office-water'], '컴퓨터는 내 자리 하나, 정수기')
  assert.equal(nearestInteraction('office-1', 145, 510)?.kind, OFFICE_COMPUTERS['service-my-desk'])
  assert.equal(nearestInteraction('office-1', 145, 210), undefined, '아이디어 자리는 게시판이 아니다')
  assert.equal(ROOMS['office-2'].name, '협동 연구실')
  assert.equal(ROOMS['office-4'].name, '개인 기숙사')
  assert.equal(ROOMS['office-4'].interactions.length, 0, '개인 기숙사는 가구로만 꾸민다')
  assert.deepEqual(ROOMS['office-2'].interactions.map(item => item.kind), ['usemap'], '협동 연구실 가운데 단말기는 유즈맵 대기실')
  assert.equal(ROOMS['office-3'].name, '오락 연구실')
  assert.deepEqual(ROOMS.lobby.doors.find(door => door.target === 'office-3') && [ROOMS.lobby.doors.find(door => door.target === 'office-3').x, ROOMS.lobby.doors.find(door => door.target === 'office-3').y], [70, 520], '오락실은 로비 왼쪽 아래 문')
  assert.equal(ROOMS['office-3'].doors[0].target, 'lobby')
  assert.equal(nearestInteraction('office-3', 400, 290)?.kind, 'arcade')
  assert.deepEqual(QA_NEXT.REGISTERED, { status: 'IN_PROGRESS', label: '조치 중으로' })
  assert.equal(QA_NEXT.RESOLVED, undefined, '조치 완료 다음은 없다')
  assert.equal(javaString('%s "님"'), '"%s \\"님\\""', '따옴표는 역슬래시로')
  assert.equal(javaString('a\\b'), '"a\\\\b"', '역슬래시는 두 번')
})

test('서비스 연구실 API 요청 형식: 아이디어·QA 등록, QA 단계 변경, 오늘 업무 보상, 자바 채점', async () => {
  const original = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url, options = {}) => { seen.push([url, options.method ?? 'GET', options.body && JSON.parse(options.body)]); return new Response('[]', { headers: { 'Content-Type': 'application/json' } }) }
  try {
    await createIdea(' 낚시 대회 ', ' 주말마다 ')
    await fetchQa()
    await createQa('버그', '내용')
    await moveQa('a/b', 'IN_PROGRESS')
    await claimDailyReward()
    await answerJava('sum', '%d + %d = %d')
    assert.deepEqual(seen, [
      ['/api/ideas', 'POST', { title: '낚시 대회', content: '주말마다' }],
      ['/api/qa', 'GET', undefined],
      ['/api/qa', 'POST', { title: '버그', content: '내용' }],
      ['/api/qa/a%2Fb/status', 'POST', { status: 'IN_PROGRESS' }],
      ['/api/desk/claim', 'POST', undefined],
      ['/api/desk/java', 'POST', { problemId: 'sum', format: '%d + %d = %d' }],
    ])
    globalThis.fetch = async () => new Response('', { status: 409 })
    await assert.rejects(moveQa('x', 'RESOLVED'), error => error.status === 409)
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

test('오락실 내기: 위쪽 오락기 넷이 홀짝·사다리·주사위·슬롯이고, 사다리 길은 서버와 같은 규칙으로 따라간다', async () => {
  const { GAMBLE_MACHINES, ladderPath, resultText } = await import('../src/features/arcade/gambleApi.ts')
  const ids = ROOMS['office-3'].interactions.filter(item => item.kind === 'gamble').map(item => item.id)
  assert.deepEqual(ids.map(id => GAMBLE_MACHINES[id]), ['ODD_EVEN', 'LADDER', 'DICE', 'SLOT'])
  assert.deepEqual(ladderPath(0, [0, -1, 1, 1, 0, -1]), [0, 1, 1, 2, 1, 0, 0])
  assert.match(resultText({ game: 'DICE', pick: '3', bet: 10, numbers: [3], win: true, payout: 55, coins: 0, betsLeftToday: 1 }), /당첨! 55원/)
  assert.match(resultText({ game: 'SLOT', pick: '', bet: 10, numbers: [1, 1, 2], win: false, payout: 5, coins: 0, betsLeftToday: 1 }), /5원만/)
  assert.match(resultText({ game: 'ODD_EVEN', pick: 'ODD', bet: 4, numbers: [1, 1], win: false, payout: 0, coins: 0, betsLeftToday: 1 }), /4원을 잃었어요/)
})

test('오락실 게임 고르기: 벽돌 부수기·블록 쌓기·지렁이·하늘 순찰대', async () => {
  const { ARCADE_GAMES } = await import('../src/features/arcade/arcadeGames.ts')
  assert.deepEqual(ARCADE_GAMES.map(game => game.id), ['breakout', 'blocks', 'snake', 'sky'])
})

const keys = (patch = {}) => ({ left: false, right: false, up: false, down: false, action: false, ...patch })
const input = (pressed = {}, held = {}) => ({ pressed: keys(pressed), held: keys(held) })
const fixed = () => 0.5

test('블록 쌓기: 꽉 찬 줄을 지우고, 벽 밖으로는 못 옮기며, 바로 떨어뜨리면 바닥에 붙는다', async () => {
  const { blockStack, emptyBoard, fits, lock, COLS, ROWS } = await import('../src/features/arcade/blockStack.ts')
  const board = emptyBoard()
  for (let x = 0; x < COLS; x++) if (x < 4 || x > 7) board[ROWS - 1][x] = 0
  const flat = { kind: 0, cells: [[0, 0], [-1, 0], [1, 0], [2, 0]], x: 5, y: ROWS - 1 }
  const { board: after, cleared } = lock(board, flat)
  assert.equal(cleared, 1); assert.ok(after[ROWS - 1].every(cell => cell === -1))
  assert.equal(fits(emptyBoard(), { ...flat, x: 1, y: 0 }, -1, 0), false, '왼쪽 벽')
  let state = blockStack.step(blockStack.create(fixed), 0.016, input({ action: true }), fixed).state
  assert.equal(state.phase, 'playing')
  const dropped = blockStack.step(state, 0.016, input({ action: true }), fixed)
  assert.ok(dropped.events.includes('hit'))
  assert.ok(dropped.state.board[ROWS - 1].some(cell => cell >= 0), '바닥에 붙음')
  assert.ok(dropped.state.score > 0)
})

test('지렁이: 사과를 먹으면 길어지고, 반대 방향으로는 못 돌며, 벽에 부딪히면 끝', async () => {
  const { snake, turn } = await import('../src/features/arcade/snake.ts')
  assert.deepEqual(turn({ x: 1, y: 0 }, input({ left: true })), { x: 1, y: 0 })
  assert.deepEqual(turn({ x: 1, y: 0 }, input({ up: true })), { x: 0, y: -1 })
  let state = { ...snake.step(snake.create(fixed), 0, input({ action: true }), fixed).state }
  state = { ...state, apple: { x: 9, y: 12 } }
  let ate = { state, events: [] }
  for (let i = 0; i < 5 && !ate.events.includes('score'); i++) ate = snake.step(ate.state, 0.05, input(), fixed)
  assert.ok(ate.events.includes('score')); assert.equal(ate.state.body.length, 4)
  let walking = { ...ate.state, apple: { x: 0, y: 0 } }
  let over = false
  for (let i = 0; i < 400 && !over; i++) { const result = snake.step(walking, 0.05, input(), fixed); walking = result.state; over = result.state.phase === 'over' }
  assert.ok(over, '오른쪽 벽에 부딪힘')
})

test('하늘 순찰대: 자동 사격으로 적기를 떨어뜨리고, 적기와 부딪히면 목숨이 준다', async () => {
  const { skyPatrol } = await import('../src/features/arcade/skyPatrol.ts')
  let state = skyPatrol.step(skyPatrol.create(fixed), 0, input({ action: true }), fixed).state
  state = { ...state, spawn: 99, enemies: [{ x: 160, y: 150, vx: 0, vy: 0, hp: 1, fire: 99 }] }
  let scored = false
  for (let i = 0; i < 30 && !scored; i++) { const result = skyPatrol.step(state, 0.03, input(), fixed); state = result.state; scored = result.events.includes('score') }
  assert.ok(scored); assert.equal(state.score >= 50, true)
  state = { ...state, bullets: [], reload: 99, enemies: [{ x: state.plane.x, y: state.plane.y, vx: 0, vy: 0, hp: 1, fire: 99 }] }
  const hit = skyPatrol.step(state, 0.016, input(), fixed)
  assert.ok(hit.events.includes('hit')); assert.equal(hit.state.lives, 2)
})

test('유즈맵 대기실: 맵 메시지 검사와 방장·준비·시작 조건', async () => {
  const { parseFromMap, roomActions, SDK_SOURCE } = await import('../src/features/usemap/usemapClient.ts')
  assert.equal(parseFromMap({ source: SDK_SOURCE, type: 'send', data: { k: 'h', id: 3 } })?.type, 'send')
  assert.equal(parseFromMap({ source: SDK_SOURCE, type: 'end', result: { win: true } })?.type, 'end')
  assert.equal(parseFromMap({ source: SDK_SOURCE, type: 'end' }), null, '결과 없는 끝은 무시')
  assert.equal(parseFromMap({ source: 'other', type: 'send' }), null, '다른 창 메시지는 무시')
  assert.equal(parseFromMap('hello'), null)
  const room = { id: 'r1', name: '방', mapId: 'bug-squash', maxPlayers: 4, locked: false, hostId: 'a', players: [{ id: 'a', nickname: '가' }, { id: 'b', nickname: '나' }], ready: [], playing: false }
  const map = { id: 'bug-squash', name: '협동 버그 잡기', minPlayers: 1, maxPlayers: 8 }
  assert.equal(roomActions(room, 'a', map).canStart, false)
  assert.match(roomActions(room, 'a', map).waitingFor, /모두 준비/)
  assert.equal(roomActions({ ...room, ready: ['b'] }, 'a', map).canStart, true)
  assert.equal(roomActions({ ...room, ready: ['b'] }, 'b', map).canStart, false, '방장만 시작')
  assert.equal(roomActions({ ...room, ready: ['b'] }, 'b', map).ready, true)
})

test('유즈맵 목록: 화면·서버가 같이 읽는 shared/usemaps.json에 맵 실행 파일이 있다', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  const catalog = JSON.parse(readFileSync(new URL('../../shared/usemaps.json', import.meta.url), 'utf8'))
  for (const map of catalog.maps) {
    assert.match(map.id, /^[a-z0-9-]{1,30}$/)
    assert.ok(map.minPlayers >= 1 && map.maxPlayers <= 8 && map.minPlayers <= map.maxPlayers, map.id)
    assert.ok(existsSync(new URL(`../public${map.entry}`, import.meta.url)), `${map.id} 실행 파일`)
  }
  assert.ok(existsSync(new URL('../public/usemaps/sdk/usemap-sdk.js', import.meta.url)), 'SDK')
})
