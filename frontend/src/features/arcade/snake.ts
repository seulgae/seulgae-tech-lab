import { SCREEN, banner, clampDt } from './retroGame.ts'
import type { Phase, RetroEvent, RetroGame, RetroInput } from './retroGame.ts'

/**
 * 지렁이 사과 먹기: 방향키로 지렁이를 움직여 사과를 먹으면 한 칸 길어지고 빨라진다. 벽이나 제 몸에 부딪히면 끝.
 * 32×24 칸, 칸 하나는 10px.
 *
 * @author 길태형
 * @version 1.0, 오락실 게임 고르기
 * @see None
 */
export const GRID = { cols: 32, rows: 24, cell: 10 }
export type Point = { x: number; y: number }
export type Snake = { phase: Phase; score: number; body: Point[]; dir: Point; nextDir: Point; apple: Point; timer: number; eaten: number }

/** 사과 하나 먹을 때마다 짧아지는 한 칸 이동 시간(초) */
export const moveSeconds = (eaten: number) => Math.max(0.05, 0.14 - eaten * 0.003)

/**
 * 몸과 겹치지 않는 빈 칸에 사과를 놓는다.
 *
 * @param body 지렁이 몸
 * @param random 난수
 * @returns 사과 위치
 */
export function placeApple(body: Point[], random: () => number): Point {
  const free: Point[] = []
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) if (!body.some(part => part.x === x && part.y === y)) free.push({ x, y })
  return free[Math.floor(random() * free.length)] ?? { x: 0, y: 0 }
}

/**
 * 누른 방향으로 바꾼다. 바로 뒤(제 몸 쪽)로는 돌지 않는다.
 *
 * @param current 지금 방향
 * @param input 입력
 * @returns 다음 방향
 */
export function turn(current: Point, input: RetroInput): Point {
  const wanted = input.pressed.up ? { x: 0, y: -1 } : input.pressed.down ? { x: 0, y: 1 } : input.pressed.left ? { x: -1, y: 0 } : input.pressed.right ? { x: 1, y: 0 } : null
  if (!wanted || (wanted.x === -current.x && wanted.y === -current.y)) return current
  return wanted
}

export const snake: RetroGame<Snake> = {
  id: 'snake', name: '지렁이 사과 먹기', highKey: 'seulgae.arcade.snake',
  help: '방향키(또는 화면 버튼)로 움직여 사과를 먹어요. 벽과 제 몸은 피해요.',
  create: random => {
    const body = [{ x: 8, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 12 }]
    return { phase: 'ready', score: 0, body, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, apple: placeApple(body, random), timer: 0, eaten: 0 }
  },
  stat: state => `LENGTH ${state.body.length}`,
  step(state, seconds, input, random) {
    const events: RetroEvent[] = []
    if (state.phase !== 'playing') {
      if (!input.pressed.action) return { state, events }
      return { state: { ...snake.create(random), phase: 'playing' }, events }
    }
    /* 한 칸 움직이기 전에 여러 번 눌러도 마지막 방향만 쓰고, 지금 방향의 반대는 막는다 */
    const nextDir = turn(state.dir, input).x === state.dir.x && turn(state.dir, input).y === state.dir.y ? turn(state.nextDir, input) : turn(state.dir, input)
    let timer = state.timer + clampDt(seconds)
    if (timer < moveSeconds(state.eaten)) return { state: { ...state, nextDir, timer }, events }
    timer = 0
    const dir = nextDir
    const head = { x: state.body[0]!.x + dir.x, y: state.body[0]!.y + dir.y }
    const eats = head.x === state.apple.x && head.y === state.apple.y
    const body = [head, ...(eats ? state.body : state.body.slice(0, -1))]
    const crashed = head.x < 0 || head.y < 0 || head.x >= GRID.cols || head.y >= GRID.rows || body.slice(1).some(part => part.x === head.x && part.y === head.y)
    if (crashed) { events.push('over'); return { state: { ...state, phase: 'over', dir, nextDir: dir }, events } }
    if (eats) { events.push('score'); return { state: { ...state, body, dir, nextDir: dir, timer, apple: placeApple(body, random), eaten: state.eaten + 1, score: state.score + 10 + state.eaten }, events } }
    return { state: { ...state, body, dir, nextDir: dir, timer }, events }
  },
  draw(context, state, scale) {
    const c = GRID.cell * scale
    context.fillStyle = '#0d1a10'; context.fillRect(0, 0, SCREEN.width * scale, SCREEN.height * scale)
    context.fillStyle = '#12241a'
    for (let y = 0; y < GRID.rows; y++) for (let x = (y % 2); x < GRID.cols; x += 2) context.fillRect(x * c, y * c, c, c)
    /* 사과: 빨간 몸, 초록 잎 */
    context.fillStyle = '#ef4444'; context.fillRect(state.apple.x * c + scale, state.apple.y * c + 2 * scale, c - 2 * scale, c - 3 * scale)
    context.fillStyle = '#4ade80'; context.fillRect(state.apple.x * c + 5 * scale, state.apple.y * c, 3 * scale, 2 * scale)
    state.body.forEach((part, index) => {
      context.fillStyle = index === 0 ? '#f9a8d4' : index % 2 ? '#f472b6' : '#ec4899'
      context.fillRect(part.x * c + scale, part.y * c + scale, c - 2 * scale, c - 2 * scale)
    })
    const head = state.body[0]!
    context.fillStyle = '#1b1030'; context.fillRect(head.x * c + 3 * scale, head.y * c + 3 * scale, 2 * scale, 2 * scale); context.fillRect(head.x * c + 6 * scale, head.y * c + 3 * scale, 2 * scale, 2 * scale)
    if (state.phase === 'ready') banner(context, scale, 'SPACE / 탭 으로 시작')
    if (state.phase === 'over') banner(context, scale, 'GAME OVER · 다시 하기')
  },
}
