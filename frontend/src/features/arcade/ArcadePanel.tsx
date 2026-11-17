import { useEffect, useRef, useState } from 'react'
import { BALL_RADIUS, BREAKOUT_HIGH_SCORE_KEY, BRICK_SIZE, FIELD, PADDLE, newGame, stepBreakout } from './breakout'
import type { Breakout, BreakoutInput } from './breakout'
import { playSfx } from '../../audio/AudioManager'
import { TIRED_MESSAGE, inventoryStore } from '../inventory/inventoryStore'
import '../research/components/ResearchPanel.css'
import './arcade.css'

const ROW_COLORS = ['#ff4d8d', '#ff8a3d', '#ffd23f', '#4ade80', '#38bdf8', '#a78bfa']
const readHigh = () => { try { return Number(localStorage.getItem(BREAKOUT_HIGH_SCORE_KEY)) || 0 } catch { return 0 } }

/**
 * 3번 오락실의 벽돌 부수기. ←/→(또는 마우스·터치)로 패들을 움직이고 Space·클릭·탭으로 공을 쏜다.
 * 최고 점수는 이 브라우저에만 저장한다.
 *
 * @author seulgae
 * @version 1.0, 3번 오락실
 * @see "None"
 * @param props 닫기 콜백
 * @returns 오락기 모달
 */
export default function ArcadePanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [notice, setNotice] = useState('Space·클릭·탭으로 시작해요. 회원은 한 판에 1원, HP -3, 피로도 -5예요.')
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1, phase: 'ready' as Breakout['phase'], high: readHigh() })

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const scale = 2
    canvas.width = FIELD.width * scale; canvas.height = FIELD.height * scale
    context.imageSmoothingEnabled = false
    let state = newGame()
    const input: BreakoutInput = { left: false, right: false, pointerX: null, launch: false }
    let last = performance.now(), frame = 0, high = readHigh()
    const keys = (down: boolean) => (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') { input.left = down; input.pointerX = null; event.preventDefault() }
      if (event.key === 'ArrowRight' || event.key === 'd') { input.right = down; input.pointerX = null; event.preventDefault() }
      if (down && (event.key === ' ' || event.key === 'Enter')) { input.launch = true; event.preventDefault() }
    }
    const onDown = keys(true), onUp = keys(false)
    const pointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      input.pointerX = (event.clientX - rect.left) / rect.width * FIELD.width
    }
    const tap = (event: PointerEvent) => { pointer(event); input.launch = true }
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp)
    canvas.addEventListener('pointermove', pointer); canvas.addEventListener('pointerdown', tap)

    const draw = () => {
      context.fillStyle = '#0b0618'; context.fillRect(0, 0, canvas.width, canvas.height)
      for (const brick of state.bricks) if (brick.alive) {
        context.fillStyle = ROW_COLORS[brick.row]!
        context.fillRect(brick.x * scale, brick.y * scale, BRICK_SIZE.width * scale, BRICK_SIZE.height * scale)
        context.fillStyle = 'rgba(255,255,255,.35)'; context.fillRect(brick.x * scale, brick.y * scale, BRICK_SIZE.width * scale, 2)
      }
      context.fillStyle = '#f472b6'; context.fillRect(state.paddleX * scale, PADDLE.y * scale, PADDLE.width * scale, PADDLE.height * scale)
      context.fillStyle = '#ffffff'
      context.fillRect((state.ball.x - BALL_RADIUS) * scale, (state.ball.y - BALL_RADIUS) * scale, BALL_RADIUS * 2 * scale, BALL_RADIUS * 2 * scale)
      if (state.phase !== 'playing') {
        context.fillStyle = 'rgba(11,6,24,.6)'; context.fillRect(0, 150 * scale, canvas.width, 40 * scale)
        context.fillStyle = '#ffd23f'; context.font = `bold ${12 * scale}px monospace`; context.textAlign = 'center'
        const message = state.phase === 'ready' ? 'SPACE / 탭 으로 발사' : state.phase === 'clear' ? `STAGE ${state.level} CLEAR! 다음 판 →` : 'GAME OVER · 다시 하기'
        context.fillText(message, canvas.width / 2, 175 * scale)
      }
    }
    // 새 게임을 시작할 때 동전 1원(회원). 비회원은 무료, 동전이 없으면 시작하지 않는다.
    let paid = false, paying = false
    const fresh = () => state.phase === 'ready' && state.level === 1 && state.score === 0 && state.lives === 3
    const loop = (now: number) => {
      if (input.launch && fresh() && !paid) {
        input.launch = false
        if (!paying) {
          paying = true
          void inventoryStore.payArcade().then(result => {
            paying = false
            if (result === 'broke') { setNotice('동전이 부족해요. 사무실 게시판에 글을 등록하면 10원을 받아요.'); playSfx('error', { volume: 0.5 }); return }
            if (result === 'tired') { setNotice(TIRED_MESSAGE); playSfx('error', { volume: 0.5 }); return }
            paid = true; input.launch = true
            setNotice(result === 'paid' ? '동전 1원을 넣었어요(HP -3, 피로도 -5). 행운을 빌어요!' : '비회원은 무료로 즐겨요.')
          })
        }
      }
      const before = state.phase
      const { state: next, events } = stepBreakout(state, (now - last) / 1000, input)
      last = now; input.launch = false
      state = next
      if (before === 'over' && state.phase === 'ready') paid = false
      for (const event of events) {
        if (event === 'brick') playSfx('click', { volume: 0.5, rate: 1.4 })
        if (event === 'paddle') playSfx('beep', { volume: 0.35 })
        if (event === 'lose') playSfx('error', { volume: 0.5 })
        if (event === 'clear') playSfx('success', { volume: 0.7 })
      }
      if (state.score > high) { high = state.score; try { localStorage.setItem(BREAKOUT_HIGH_SCORE_KEY, String(high)) } catch { /* 저장 불가 */ } }
      if (events.length || frame % 10 === 0) setHud({ score: state.score, lives: state.lives, level: state.level, phase: state.phase, high })
      draw()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp)
      canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', tap)
    }
  }, [])

  return (
    <dialog ref={dialogRef} className="research-panel arcade-panel" aria-labelledby="arcade-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">OFFICE 3 / ARCADE</p>
          <h2 id="arcade-title">벽돌 부수기</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose}>닫기</button>
      </header>
      <div className="arcade-hud" aria-live="polite">
        <span>SCORE <strong>{hud.score}</strong></span><span>STAGE <strong>{hud.level}</strong></span>
        <span>LIFE <strong>{'♥'.repeat(Math.max(hud.lives, 0))}</strong></span><span>HI <strong>{hud.high}</strong></span>
      </div>
      <p className="arcade-notice" role="status">{notice}</p>
      <canvas ref={canvasRef} className="arcade-screen" aria-label="벽돌 부수기 화면. 왼쪽·오른쪽 방향키로 움직이고 스페이스로 발사" />
      <p className="research-footer">←/→ 또는 마우스·터치로 움직이고, Space·클릭·탭으로 발사해요. ESC로 닫아요.</p>
    </dialog>
  )
}
