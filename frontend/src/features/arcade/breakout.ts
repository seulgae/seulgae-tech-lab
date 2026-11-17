/**
 * 3번 오락실 벽돌 부수기 규칙. 화면(캔버스)과 분리한 순수 함수라 node 테스트로 검증한다.
 * 좌표는 320×240 논리 화면 기준이다.
 */
export const FIELD = { width: 320, height: 240 }
export const PADDLE = { width: 52, height: 6, y: 224, speed: 260 }
export const BALL_RADIUS = 3
const ROWS = 6, COLUMNS = 10, BRICK = { width: 28, height: 10, gap: 2, top: 30, left: 11 }
export const BREAKOUT_HIGH_SCORE_KEY = 'seulgae.arcade.breakout'

export type Brick = { x: number; y: number; row: number; alive: boolean }
export type Breakout = {
  phase: 'ready' | 'playing' | 'over' | 'clear'
  level: number; score: number; lives: number
  paddleX: number; ball: { x: number; y: number; vx: number; vy: number }
  bricks: Brick[]
}
export type BreakoutInput = { left: boolean; right: boolean; pointerX?: number | null; launch: boolean }
export type BreakoutEvent = 'brick' | 'paddle' | 'wall' | 'lose' | 'clear' | 'over'

export function createBricks(): Brick[] {
  return Array.from({ length: ROWS * COLUMNS }, (_, index) => {
    const row = Math.floor(index / COLUMNS), column = index % COLUMNS
    return { row, alive: true, x: BRICK.left + column * (BRICK.width + BRICK.gap), y: BRICK.top + row * (BRICK.height + BRICK.gap) }
  })
}

/** 레벨이 오를수록 공이 빨라진다. */
const speedFor = (level: number) => 150 + (level - 1) * 25

export function newGame(level = 1, score = 0, lives = 3): Breakout {
  const paddleX = (FIELD.width - PADDLE.width) / 2
  return { phase: 'ready', level, score, lives, paddleX, ball: { x: FIELD.width / 2, y: PADDLE.y - BALL_RADIUS - 1, vx: 0, vy: 0 }, bricks: createBricks() }
}

/** 윗줄 벽돌일수록 점수가 크다(맨 위 60점 … 맨 아래 10점). */
export const brickScore = (row: number) => (ROWS - row) * 10

/**
 * 한 프레임을 진행한다. 새 상태와 이번 프레임에 일어난 일(소리·효과용)을 돌려준다.
 * @param seconds 경과 시간(초). 탭 전환 등으로 크게 튀지 않게 0.05초로 자른다.
 */
export function stepBreakout(state: Breakout, seconds: number, input: BreakoutInput): { state: Breakout; events: BreakoutEvent[] } {
  const dt = Math.min(Math.max(seconds, 0), 0.05)
  const events: BreakoutEvent[] = []
  const s: Breakout = { ...state, ball: { ...state.ball }, bricks: state.bricks }
  // 패들: 마우스·터치 위치가 있으면 따라가고, 없으면 방향키
  if (input.pointerX != null) s.paddleX = input.pointerX - PADDLE.width / 2
  else s.paddleX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * PADDLE.speed * dt
  s.paddleX = Math.min(Math.max(s.paddleX, 0), FIELD.width - PADDLE.width)

  if (s.phase === 'over' || s.phase === 'clear') {
    if (!input.launch) return { state: s, events }
    return { state: s.phase === 'over' ? newGame() : newGame(s.level + 1, s.score, s.lives), events }
  }
  if (s.phase === 'ready') {
    s.ball.x = s.paddleX + PADDLE.width / 2; s.ball.y = PADDLE.y - BALL_RADIUS - 1
    if (input.launch) {
      const speed = speedFor(s.level)
      s.phase = 'playing'; s.ball.vx = speed * 0.45; s.ball.vy = -speed * 0.9
    }
    return { state: s, events }
  }

  const b = s.ball
  b.x += b.vx * dt; b.y += b.vy * dt
  if (b.x < BALL_RADIUS) { b.x = BALL_RADIUS; b.vx = Math.abs(b.vx); events.push('wall') }
  if (b.x > FIELD.width - BALL_RADIUS) { b.x = FIELD.width - BALL_RADIUS; b.vx = -Math.abs(b.vx); events.push('wall') }
  if (b.y < BALL_RADIUS) { b.y = BALL_RADIUS; b.vy = Math.abs(b.vy); events.push('wall') }

  // 패들: 맞은 위치에 따라 튕기는 각도가 바뀐다(가장자리일수록 옆으로).
  if (b.vy > 0 && b.y + BALL_RADIUS >= PADDLE.y && b.y - BALL_RADIUS <= PADDLE.y + PADDLE.height
      && b.x >= s.paddleX - BALL_RADIUS && b.x <= s.paddleX + PADDLE.width + BALL_RADIUS) {
    const speed = Math.hypot(b.vx, b.vy)
    const offset = Math.min(Math.max((b.x - (s.paddleX + PADDLE.width / 2)) / (PADDLE.width / 2), -1), 1)
    const angle = offset * (Math.PI / 3)
    b.vx = speed * Math.sin(angle); b.vy = -speed * Math.cos(angle)
    b.y = PADDLE.y - BALL_RADIUS
    events.push('paddle')
  }

  // 벽돌: 한 프레임에 하나만 깨고, 겹친 방향으로 튕긴다.
  const hit = s.bricks.findIndex(brick => brick.alive && b.x + BALL_RADIUS > brick.x && b.x - BALL_RADIUS < brick.x + BRICK.width
    && b.y + BALL_RADIUS > brick.y && b.y - BALL_RADIUS < brick.y + BRICK.height)
  if (hit >= 0) {
    const brick = s.bricks[hit]!
    s.bricks = s.bricks.map((item, index) => index === hit ? { ...item, alive: false } : item)
    const overlapX = Math.min(b.x + BALL_RADIUS - brick.x, brick.x + BRICK.width - (b.x - BALL_RADIUS))
    const overlapY = Math.min(b.y + BALL_RADIUS - brick.y, brick.y + BRICK.height - (b.y - BALL_RADIUS))
    if (overlapX < overlapY) b.vx = -b.vx; else b.vy = -b.vy
    s.score += brickScore(brick.row) * s.level
    events.push('brick')
    if (s.bricks.every(item => !item.alive)) { s.phase = 'clear'; events.push('clear') }
  }

  if (b.y - BALL_RADIUS > FIELD.height) {
    s.lives -= 1
    events.push('lose')
    if (s.lives <= 0) { s.phase = 'over'; events.push('over') }
    else { s.phase = 'ready'; b.vx = 0; b.vy = 0 }
  }
  return { state: s, events }
}

export const BRICK_SIZE = BRICK
