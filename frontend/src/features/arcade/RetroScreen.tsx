import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../../audio/AudioManager'
import { arcadeIntro, arcadeNotice, inventoryStore } from '../inventory/inventoryStore'
import { NO_KEYS, SCREEN } from './retroGame'
import type { Keys, Phase, RetroGame } from './retroGame'

const KEY_MAP: Record<string, keyof Keys> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ' ': 'action', Enter: 'action',
}
const readHigh = (key: string) => { try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 } }

/**
 * 블록 쌓기·지렁이·하늘 순찰대가 함께 쓰는 오락기 화면: 키보드와 화면 버튼 입력, 프레임 진행, 효과음, 최고 점수.
 * 새 판을 시작할 때 회원은 동전 1원(HP·기력은 ARCADE_PLAY 규칙)을 내고, 비회원은 무료로 한다(벽돌 부수기와 같다).
 *
 * @author 길태형
 * @version 1.0, 오락실 게임 고르기
 * @see "None"
 * @param props 게임
 * @returns 게임 화면
 */
export default function RetroScreen<S extends { phase: Phase; score: number }>({ game }: { game: RetroGame<S> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pad = useRef<{ held: Keys; pressed: Keys }>({ held: { ...NO_KEYS }, pressed: { ...NO_KEYS } })
  const [notice, setNotice] = useState(arcadeIntro(null))
  /* 처음 열 때 오늘 남은 판 수를 안내에 넣는다(비회원은 그대로) */
  useEffect(() => { void inventoryStore.arcadePlaysLeft().then(left => { if (left !== null) setNotice(arcadeIntro(left)) }) }, [])
  const [hud, setHud] = useState({ score: 0, stat: '', high: readHigh(game.highKey) })

  useEffect(() => {
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const scale = 2
    canvas.width = SCREEN.width * scale; canvas.height = SCREEN.height * scale
    context.imageSmoothingEnabled = false
    const random = Math.random
    let state = game.create(random)
    let last = performance.now(), frame = 0, high = readHigh(game.highKey)
    const input = pad.current
    const keys = (down: boolean) => (event: KeyboardEvent) => {
      const key = KEY_MAP[event.key]
      if (!key) return
      event.preventDefault()
      if (down && !input.held[key]) input.pressed[key] = true
      input.held[key] = down
    }
    const onDown = keys(true), onUp = keys(false)
    /* 마우스·터치: 하늘 순찰대는 누른 쪽으로 비행기를 끌고, 다른 게임은 탭이 시작 버튼이다 */
    const pointer = (event: PointerEvent) => {
      if (game.id !== 'sky' || !('plane' in (state as object))) return
      if (event.type === 'pointermove' && event.buttons === 0 && event.pointerType !== 'mouse') return
      const rect = canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width * SCREEN.width, y = (event.clientY - rect.top) / rect.height * SCREEN.height
      const plane = (state as unknown as { plane: { x: number; y: number } }).plane
      input.held.left = x < plane.x - 4; input.held.right = x > plane.x + 4; input.held.up = y < plane.y - 4; input.held.down = y > plane.y + 4
    }
    const leave = () => { if (game.id === 'sky') Object.assign(input.held, { left: false, right: false, up: false, down: false }) }
    const tap = (event: PointerEvent) => { input.pressed.action = true; pointer(event) }
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp)
    canvas.addEventListener('pointerdown', tap); canvas.addEventListener('pointermove', pointer); canvas.addEventListener('pointerleave', leave)

    /* 새 판은 동전을 낸 뒤에 시작한다(내는 중에는 시작 키를 미룬다). */
    let paid = false, paying = false
    const loop = (now: number) => {
      const starting = state.phase !== 'playing' && input.pressed.action
      if (starting && !paid) {
        input.pressed.action = false
        if (!paying) {
          paying = true
          void inventoryStore.payArcade().then(result => {
            paying = false
            if (result === 'broke' || result === 'tired' || result === 'limit') { setNotice(arcadeNotice(result, null)); playSfx('error', { volume: 0.5 }); return }
            paid = true; input.pressed.action = true
            void inventoryStore.arcadePlaysLeft().then(left => setNotice(arcadeNotice(result, result === 'paid' ? left : null)))
          })
        }
      }
      const { state: next, events } = game.step(state, (now - last) / 1000, input, random)
      last = now
      if (state.phase !== 'playing' && next.phase === 'playing') paid = false
      state = next
      Object.assign(input.pressed, NO_KEYS)
      for (const event of events) {
        if (event === 'score') playSfx('click', { volume: 0.5, rate: 1.4 })
        if (event === 'clear') playSfx('success', { volume: 0.6 })
        if (event === 'hit') playSfx('beep', { volume: 0.3 })
        if (event === 'over') playSfx('error', { volume: 0.5 })
      }
      if (state.score > high) { high = state.score; try { localStorage.setItem(game.highKey, String(high)) } catch { /* 저장 불가 */ } }
      if (events.length || frame % 10 === 0) setHud({ score: state.score, stat: game.stat(state), high })
      game.draw(context, state, scale)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp)
      canvas.removeEventListener('pointerdown', tap); canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerleave', leave)
    }
  }, [game])

  /* 화면 버튼(모바일): 누르는 동안 held, 누른 순간 pressed */
  const press = (key: keyof Keys, down: boolean) => {
    const input = pad.current
    if (down && !input.held[key]) input.pressed[key] = true
    input.held[key] = down
  }
  const button = (key: keyof Keys, label: string) => (
    <button type="button" aria-label={label} onPointerDown={event => { event.preventDefault(); press(key, true) }} onPointerUp={() => press(key, false)} onPointerLeave={() => press(key, false)}>
      {{ left: '◀', right: '▶', up: '▲', down: '▼', action: 'A' }[key]}
    </button>
  )

  return (
    <>
      <div className="arcade-hud" aria-live="polite">
        <span>SCORE <strong>{hud.score}</strong></span><span><strong>{hud.stat}</strong></span><span>HI <strong>{hud.high}</strong></span>
      </div>
      <p className="arcade-notice" role="status">{notice}</p>
      <canvas ref={canvasRef} className="arcade-screen retro-screen" aria-label={`${game.name} 화면. ${game.help}`} />
      <div className="arcade-pad" aria-label="화면 버튼">
        {button('left', '왼쪽')}{button('up', '위')}{button('down', '아래')}{button('right', '오른쪽')}{button('action', '시작·액션')}
      </div>
      <p className="research-footer">{game.help} ESC로 닫아요.</p>
    </>
  )
}
