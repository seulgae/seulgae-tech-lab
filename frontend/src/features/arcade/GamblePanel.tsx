import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../../audio/AudioManager'
import { inventoryStore, useInventory } from '../inventory/inventoryStore'
import { useAuth, LOGIN_URL } from '../auth/authStore'
import { GAMES, LADDER_ROWS, MAX_BET, MIN_BET, SLOT_SYMBOLS, ladderPath, playGamble, resultText } from './gambleApi'
import type { GambleGame, GambleResult } from './gambleApi'
import '../../components/panel.css'
import './arcade.css'

/** 결과를 보여 주기 전 연출 시간(ms) */
const REVEAL_MS = 1100

/**
 * 오락실 내기 게임 창(홀짝·사다리·주사위·슬롯). 동전을 걸고 고른 뒤 돌리면 서버가 정한 결과를 연출해 보여 준다.
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 * @param props 게임, 닫기 콜백
 * @returns 내기 게임 모달
 */
export default function GamblePanel({ game, onClose }: { game: GambleGame; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inventory = useInventory()
  const auth = useAuth()
  const info = GAMES[game]
  const [bet, setBet] = useState(5)
  const [pick, setPick] = useState(info.picks[0]?.value ?? '')
  const [result, setResult] = useState<GambleResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); void inventoryStore.refresh(); return () => dialog?.close() }, [])

  const play = async () => {
    if (rolling) return
    setRolling(true); setError(null); setResult(null)
    playSfx('coin', { volume: 0.5 })
    const started = performance.now()
    try {
      const next = await playGamble(game, bet, pick)
      /* 서버 결과가 빨리 와도 연출 시간만큼 기다렸다 보여 준다. */
      await new Promise(resolve => window.setTimeout(resolve, Math.max(0, REVEAL_MS - (performance.now() - started))))
      setResult(next)
      playSfx(next.win ? 'success' : 'error', { volume: 0.6 })
      void inventoryStore.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요청에 실패했어요.')
    } finally { setRolling(false) }
  }

  return (
    <dialog ref={dialogRef} className="research-panel arcade-panel gamble-panel" aria-labelledby="gamble-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">OFFICE 3 / BACK ROOM</p>
          <h2 id="gamble-title">{info.name}</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose}>닫기</button>
      </header>
      <p className="arcade-notice">{info.rule}. 게임 동전으로만 하는 놀이예요.</p>

      {!auth.member ? (
        <p className="gamble-login">로그인한 연구원만 동전을 걸 수 있어요. <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>
      ) : (
        <>
          {/* 연출 화면: 게임마다 다르게 그린다 */}
          <div className={`gamble-stage${rolling ? ' rolling' : ''}${result ? (result.win ? ' won' : ' lost') : ''}`} aria-live="polite">
            <Stage game={game} result={result} rolling={rolling} pick={pick} />
          </div>
          <p className="gamble-result" role="status">{error ?? (result ? resultText(result) : rolling ? '두근두근…' : '걸 돈과 고를 값을 정하고 돌려요.')}</p>

          {info.picks.length > 0 && (
            <div className="gamble-picks" role="radiogroup" aria-label="고르기">
              {info.picks.map(option => (
                <button key={option.value} type="button" role="radio" aria-checked={pick === option.value} disabled={rolling} onClick={() => setPick(option.value)}>{option.label}</button>
              ))}
            </div>
          )}
          <div className="gamble-bet">
            <label htmlFor="gamble-bet">걸 돈</label>
            <input id="gamble-bet" type="range" min={MIN_BET} max={MAX_BET} value={bet} disabled={rolling} onChange={event => setBet(Number(event.target.value))} />
            <strong>🪙 {bet}</strong>
            <button type="button" className="gamble-go" disabled={rolling || inventory.coins < bet} onClick={() => void play()}>{rolling ? '…' : '돌리기'}</button>
          </div>
          <p className="research-footer">내 동전 {inventory.coins.toLocaleString('ko-KR')}원{result ? ` · 오늘 ${result.betsLeftToday}판 남음` : ''} · 잃어도 웃을 수 있을 만큼만! ESC로 닫아요.</p>
        </>
      )}
    </dialog>
  )
}

/**
 * 게임별 연출 화면.
 *
 * @param props 게임, 결과, 돌리는 중인지, 고른 값
 * @returns 연출 요소
 */
function Stage({ game, result, rolling, pick }: { game: GambleGame; result: GambleResult | null; rolling: boolean; pick: string }) {
  if (game === 'LADDER') return <Ladder result={result} pick={Number(pick)} />
  if (game === 'SLOT') {
    const reels = result?.numbers ?? [0, 1, 2]
    return <div className="gamble-reels">{reels.map((symbol, index) => <span key={index} className="gamble-reel">{rolling ? '❔' : SLOT_SYMBOLS[symbol]}</span>)}</div>
  }
  const dice = result?.numbers ?? (game === 'DICE' ? [6] : [3, 4])
  return (
    <div className="gamble-dice">
      {dice.map((face, index) => <span key={index} className="gamble-die">{rolling ? '🎲' : face}</span>)}
      {game === 'ODD_EVEN' && result && !rolling && <small>합 {dice[0]! + dice[1]!} · {(dice[0]! + dice[1]!) % 2 === 0 ? '짝' : '홀'}</small>}
    </div>
  )
}

/**
 * 사다리: 세로줄 셋, 결과의 가로줄, 고른 줄이 지나간 길과 당첨 칸.
 *
 * @param props 결과, 고른 줄
 * @returns SVG 사다리
 */
function Ladder({ result, pick }: { result: GambleResult | null; pick: number }) {
  const x = (lane: number) => 40 + lane * 80
  const y = (row: number) => 20 + row * 20
  const rungs = result ? result.numbers.slice(1, 1 + LADDER_ROWS) : []
  const path = result ? ladderPath(pick, rungs) : []
  const prize = result?.numbers[0]
  /* 길: 행마다 세로로 내려간 뒤 가로줄을 따라 옆 줄로 건너간다. */
  const points = path.flatMap((lane, row) => row === 0 ? [`${x(lane)},${y(0)}`] : [`${x(path[row - 1]!)},${y(row) - 10}`, `${x(lane)},${y(row) - 10}`, `${x(lane)},${y(row)}`])
  return (
    <svg className="gamble-ladder" viewBox="0 0 240 170" role="img" aria-label={result ? `${pick + 1}번 줄이 ${path[path.length - 1]! + 1}번 칸에 도착` : '사다리'}>
      {[0, 1, 2].map(lane => <line key={lane} x1={x(lane)} y1={y(0)} x2={x(lane)} y2={y(LADDER_ROWS)} stroke="#c4b5fd" strokeWidth="3" />)}
      {rungs.map((rung, row) => rung >= 0 && <line key={row} x1={x(rung)} y1={y(row + 1) - 10} x2={x(rung + 1)} y2={y(row + 1) - 10} stroke="#c4b5fd" strokeWidth="3" />)}
      {result && <polyline points={points.join(' ')} fill="none" stroke="#ffd23f" strokeWidth="4" className="gamble-ladder-path" />}
      {[0, 1, 2].map(lane => (
        <text key={lane} x={x(lane)} y={y(LADDER_ROWS) + 22} textAnchor="middle" fontSize="13" fill={prize === lane ? '#ffd23f' : '#8b7aa8'}>{result ? (prize === lane ? '당첨' : '꽝') : '?'}</text>
      ))}
      <circle cx={x(pick)} cy={y(0) - 8} r="5" fill="#f472b6" />
    </svg>
  )
}
