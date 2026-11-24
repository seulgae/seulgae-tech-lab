import { SCREEN, banner, clampDt } from './retroGame.ts'
import type { Phase, RetroEvent, RetroGame, RetroInput } from './retroGame.ts'

/**
 * 블록 쌓기: 위에서 떨어지는 네 칸짜리 블록을 돌리고 옮겨 가로줄을 채우면 그 줄이 사라진다. 블록이 맨 위까지 쌓이면 끝.
 * 10×20 칸, 칸 하나는 11px. 줄을 많이 지울수록 레벨이 오르고 빨리 떨어진다.
 *
 * @author 길태형
 * @version 1.0, 오락실 게임 고르기
 * @see "None"
 */
export const COLS = 10, ROWS = 20, CELL = 11
const LEFT = (SCREEN.width - COLS * CELL) / 2, TOP = (SCREEN.height - ROWS * CELL) / 2
/** 블록 모양 일곱 가지(칸 좌표). 0번 칸 기준으로 돌린다. */
export const SHAPES: readonly (readonly [number, number][])[] = [
  [[0, 0], [-1, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [-1, 0], [1, 0], [0, 1]],
  [[0, 0], [-1, 0], [1, 0], [1, 1]],
  [[0, 0], [-1, 0], [1, 0], [-1, 1]],
  [[0, 0], [1, 0], [0, 1], [-1, 1]],
  [[0, 0], [-1, 0], [0, 1], [1, 1]],
]
const COLORS = ['#38bdf8', '#ffd23f', '#a78bfa', '#ff8a3d', '#4f8cff', '#4ade80', '#ff4d8d']
/** 한 번에 지운 줄 수 → 점수(레벨을 곱한다) */
export const LINE_SCORES = [0, 100, 250, 450, 700]

export type Piece = { kind: number; cells: [number, number][]; x: number; y: number }
export type BlockStack = { phase: Phase; score: number; lines: number; level: number; board: number[][]; piece: Piece; next: number; fall: number; slide: number }

/** 빈 판(-1이면 빈 칸, 아니면 색 번호) */
export const emptyBoard = () => Array.from({ length: ROWS }, () => Array<number>(COLS).fill(-1))

const spawn = (kind: number): Piece => ({ kind, cells: SHAPES[kind]!.map(([x, y]) => [x, y] as [number, number]), x: 4, y: 0 })

/**
 * 블록이 이 자리에 들어갈 수 있는지(벽·바닥·쌓인 칸과 겹치지 않는지).
 *
 * @param board 판
 * @param piece 블록
 * @param dx 옮길 칸(가로)
 * @param dy 옮길 칸(세로)
 * @param cells 돌린 모양(없으면 지금 모양)
 * @returns 들어가면 true
 */
export function fits(board: number[][], piece: Piece, dx = 0, dy = 0, cells = piece.cells): boolean {
  return cells.every(([cx, cy]) => {
    const x = piece.x + cx + dx, y = piece.y + cy + dy
    return x >= 0 && x < COLS && y < ROWS && (y < 0 || board[y]![x] === -1)
  })
}

/** 시계 방향으로 90도 돌린 모양(정사각형 블록은 그대로) */
export const rotated = (piece: Piece): [number, number][] => piece.kind === 1 ? piece.cells : piece.cells.map(([x, y]) => [-y, x])

/**
 * 블록을 판에 붙이고 꽉 찬 줄을 지운다.
 *
 * @param board 판
 * @param piece 블록
 * @returns 새 판과 지운 줄 수
 */
export function lock(board: number[][], piece: Piece): { board: number[][]; cleared: number } {
  const next = board.map(row => [...row])
  for (const [cx, cy] of piece.cells) { const y = piece.y + cy; if (y >= 0) next[y]![piece.x + cx] = piece.kind }
  const kept = next.filter(row => row.some(cell => cell === -1))
  const cleared = ROWS - kept.length
  return { board: [...Array.from({ length: cleared }, () => Array<number>(COLS).fill(-1)), ...kept], cleared }
}

/** 레벨마다 한 칸 떨어지는 시간(초) */
export const fallSeconds = (level: number) => Math.max(0.08, 0.7 - (level - 1) * 0.06)

export const blockStack: RetroGame<BlockStack> = {
  id: 'blocks', name: '블록 쌓기', highKey: 'seulgae.arcade.blocks',
  help: '←/→ 옮기기 · ↑ 돌리기 · ↓ 빨리 내리기 · Space 바로 떨어뜨리기',
  create: random => ({ phase: 'ready', score: 0, lines: 0, level: 1, board: emptyBoard(), piece: spawn(Math.floor(random() * 7)), next: Math.floor(random() * 7), fall: 0, slide: 0 }),
  stat: state => `LINES ${state.lines} · LV ${state.level}`,
  step(state, seconds, input: RetroInput, random) {
    const events: RetroEvent[] = []
    if (state.phase !== 'playing') {
      if (!input.pressed.action) return { state, events }
      return { state: { ...blockStack.create(random), phase: 'playing' }, events }
    }
    const dt = clampDt(seconds)
    let { piece, board, score, lines, level, fall, slide } = state
    /* 옮기기: 누른 순간 한 칸, 누르고 있으면 0.1초마다 한 칸 */
    const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0)
    slide = dir === 0 ? 0 : slide + dt
    const stepSide = (input.pressed.left || input.pressed.right) || slide > 0.18
    if (dir !== 0 && stepSide && fits(board, piece, dir, 0)) { piece = { ...piece, x: piece.x + dir }; events.push('move'); if (slide > 0.18) slide = 0.08 }
    if (input.pressed.up) {
      const turned = rotated(piece)
      /* 벽에 붙어 못 돌면 한 칸 밀어 본다 */
      const kick = [0, -1, 1, -2, 2].find(dx => fits(board, piece, dx, 0, turned))
      if (kick !== undefined) piece = { ...piece, x: piece.x + kick, cells: turned }
    }
    let landed = false
    if (input.pressed.action) {
      let drop = 0
      while (fits(board, piece, 0, drop + 1)) drop++
      piece = { ...piece, y: piece.y + drop }; score += drop * 2; landed = true
    } else {
      fall += dt * (input.held.down ? 8 : 1)
      if (fall >= fallSeconds(level)) {
        fall = 0
        if (fits(board, piece, 0, 1)) piece = { ...piece, y: piece.y + 1 }
        else landed = true
      }
    }
    if (landed) {
      const result = lock(board, piece)
      board = result.board
      if (result.cleared > 0) { lines += result.cleared; score += LINE_SCORES[result.cleared]! * level; level = 1 + Math.floor(lines / 10); events.push('clear') } else events.push('hit')
      const nextPiece = spawn(state.next)
      if (!fits(board, nextPiece)) { events.push('over'); return { state: { ...state, board, score, lines, level, phase: 'over' }, events } }
      return { state: { ...state, board, piece: nextPiece, next: Math.floor(random() * 7), score, lines, level, fall: 0, slide }, events }
    }
    return { state: { ...state, piece, score, fall, slide }, events }
  },
  draw(context, state, scale) {
    context.fillStyle = '#0b0618'; context.fillRect(0, 0, SCREEN.width * scale, SCREEN.height * scale)
    context.fillStyle = '#1a1030'; context.fillRect(LEFT * scale, TOP * scale, COLS * CELL * scale, ROWS * CELL * scale)
    const cell = (x: number, y: number, color: string) => {
      context.fillStyle = color; context.fillRect((LEFT + x * CELL) * scale, (TOP + y * CELL) * scale, (CELL - 1) * scale, (CELL - 1) * scale)
      context.fillStyle = 'rgba(255,255,255,.3)'; context.fillRect((LEFT + x * CELL) * scale, (TOP + y * CELL) * scale, (CELL - 1) * scale, scale)
    }
    state.board.forEach((row, y) => row.forEach((kind, x) => { if (kind >= 0) cell(x, y, COLORS[kind]!) }))
    if (state.phase === 'playing') for (const [cx, cy] of state.piece.cells) if (state.piece.y + cy >= 0) cell(state.piece.x + cx, state.piece.y + cy, COLORS[state.piece.kind]!)
    /* 다음 블록 */
    context.fillStyle = '#c4b5fd'; context.font = `${8 * scale}px monospace`; context.textAlign = 'left'
    context.fillText('NEXT', 232 * scale, 30 * scale)
    for (const [cx, cy] of SHAPES[state.next]!) { context.fillStyle = COLORS[state.next]!; context.fillRect((248 + cx * 9) * scale, (42 + cy * 9) * scale, 8 * scale, 8 * scale) }
    if (state.phase === 'ready') banner(context, scale, 'SPACE / 탭 으로 시작')
    if (state.phase === 'over') banner(context, scale, 'GAME OVER · 다시 하기')
  },
}
