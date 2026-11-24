import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../../audio/AudioManager'
import BreakoutScreen from './BreakoutScreen'
import RetroScreen from './RetroScreen'
import { ARCADE_GAMES } from './arcadeGames'
import type { ArcadeGameId } from './arcadeGames'
import { blockStack } from './blockStack'
import { snake } from './snake'
import { skyPatrol } from './skyPatrol'
import '../../components/panel.css'
import './arcade.css'

/**
 * 3번 오락실 메인 오락기: 게임 고르기 화면에서 벽돌 부수기·블록 쌓기·지렁이 사과 먹기·하늘 순찰대 중 하나를 고른다.
 * 게임 중 ESC나 "게임 고르기"를 누르면 고르기 화면으로, 고르기 화면에서 ESC면 닫힌다.
 *
 * @author 길태형
 * @version 2.0, 오락실 게임 고르기
 * @see None
 * @param props 닫기 콜백
 * @returns 오락기 모달
 */
export default function ArcadePanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [game, setGame] = useState<ArcadeGameId | null>(null)
  const current = ARCADE_GAMES.find(entry => entry.id === game)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])

  const pick = (id: ArcadeGameId | null) => { setGame(id); playSfx('click', { volume: 0.5 }) }

  return (
    <dialog ref={dialogRef} className="research-panel arcade-panel" aria-labelledby="arcade-title"
      onCancel={event => { event.preventDefault(); if (game) pick(null); else onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">OFFICE 3 / ARCADE</p>
          <h2 id="arcade-title">{current?.name ?? '오락기 · 게임 고르기'}</h2>
        </div>
        <div className="arcade-header-actions">
          {game && <button type="button" className="research-close" onClick={() => pick(null)}>게임 고르기</button>}
          <button type="button" className="research-close" onClick={onClose}>닫기</button>
        </div>
      </header>

      {/* 고르기 화면: 게임 카드 넷 */}
      {!game && (
        <ul className="arcade-menu" aria-label="게임 목록">
          {ARCADE_GAMES.map(entry => (
            <li key={entry.id}>
              <button type="button" onClick={() => pick(entry.id)} style={{ ['--accent' as string]: entry.color }}>
                <span className="arcade-menu-icon" aria-hidden="true">{entry.icon}</span>
                <strong>{entry.name}</strong>
                <small>{entry.summary}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {game === 'breakout' && <BreakoutScreen />}
      {game === 'blocks' && <RetroScreen game={blockStack} />}
      {game === 'snake' && <RetroScreen game={snake} />}
      {game === 'sky' && <RetroScreen game={skyPatrol} />}
      {!game && <p className="research-footer">방향키·Enter로 골라도 돼요. 회원은 한 판에 1원(HP -3, 기력 -5), 비회원은 무료예요. ESC로 닫아요.</p>}
    </dialog>
  )
}
