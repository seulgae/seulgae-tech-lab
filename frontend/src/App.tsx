import { useEffect, useState } from 'react'
import { ROOMS } from './game/maps/rooms'
import type { RoomId } from './game/maps/rooms'
import GameCanvas from './components/GameCanvas'
import InstallBanner from './components/InstallBanner'
import SoundSettings from './audio/SoundSettings'
import { OPEN_INVENTORY_EVENT } from './features/inventory/inventoryStore'
import { ROOM_THEMES } from './game/rooms/roomThemes'
import AuthBar from './features/auth/AuthBar'
import { authStore } from './features/auth/authStore'
import './App.css'

/**
 * 앱 설치 안내와 야외에서 시작하는 게임 화면, 현재 방의 테마·조작 안내를 배치한다.
 *
 * @author seulgae
 * @version 1.3, 게임 화면 상단에 앱 설치 안내 추가
 * @see InstallBanner
 * @returns 게임 화면을 포함한 메인 영역
 */
function App() {
  const [roomId, setRoomId] = useState<RoomId>('outdoor')
  const theme = ROOM_THEMES[roomId]
  // 회원 닉네임을 이름표에 사용한다. 로그인 확인이 지연되어도 2.5초 뒤에는 게임을 시작한다.
  const [gameReady, setGameReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setGameReady(true), 2500)
    void authStore.load().finally(() => {
      const member = authStore.get().member
      if (member) { try { sessionStorage.setItem('lab.nickname', member.nickname) } catch { /* 저장소 불가 시 임시 이름 */ } }
      window.clearTimeout(timer)
      setGameReady(true)
    })
    return () => window.clearTimeout(timer)
  }, [])
  // 페이지 배경·카드·강조색도 현재 방 분위기를 따라간다.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.room = roomId
    for (const [name, value] of Object.entries(ROOM_THEMES[roomId].page)) root.style.setProperty(`--room-${name}`, value)
  }, [roomId])
  return (
    <main className="lab-shell">
      <header className="lab-header">
        <a className="lab-brand" href="#lobby" aria-label="슬개기술연구소 로비">
          <span className="brand-mark" aria-hidden="true">S<span /></span>
          <span><span className="eyebrow">SEULGAE TECH LAB</span><strong>슬개기술연구소</strong></span>
        </a>
        <div className="lab-header-right">
          <AuthBar />
          <span className="location-badge"><i aria-hidden="true" /> {ROOMS[roomId].name} <span>LAB</span></span>
        </div>
      </header>
      <InstallBanner />
      <div className="lab-layout">
        <section className="game-card" id="lobby" aria-labelledby="lobby-title">
          <header className="game-card-header">
            <div><span className="eyebrow">YOUR LITTLE PLACE TO EXPLORE</span><h1 id="lobby-title">작은 발견이 시작되는 곳</h1></div>
            <div className="header-tools">
              <button type="button" className="sound-button" aria-label="폰 열기(I)" title="폰(I)"
                onClick={() => window.dispatchEvent(new Event(OPEN_INVENTORY_EVENT))}><span aria-hidden="true">📱</span></button>
              <SoundSettings />
              <span className="room-label">{roomId.toUpperCase()}</span>
            </div>
          </header>
          {gameReady ? <GameCanvas onRoomChange={setRoomId} /> : <div className="game-canvas" aria-busy="true" aria-label="연구소를 불러오는 중" />}
          <footer className="game-controls">
            <span><kbd>W A S D</kbd><span className="control-or">/</span><kbd>↑ ← ↓ →</kbd> 이동</span>
            <span><kbd>E</kbd> 상호작용</span>
            <span><kbd>ESC</kbd> 닫기</span>
          </footer>
        </section>
        <aside className="lab-notes" aria-label={`${ROOMS[roomId].name} 안내`}>
          <span className="eyebrow">FIELD NOTES</span>
          <h2 className="multiline">{theme.notes.title}</h2>
          <p className="multiline">{theme.notes.body}</p>
          <div className="mission-card"><span className="note-number">{ROOMS[roomId].name} / EXPLORE</span><h3>{theme.notes.missionTitle}</h3><p>{theme.notes.mission}</p></div>
          <div className="map-key"><span><i className="key-player" /> 나의 연구원</span><span><i className="key-interaction" /> 상호작용 가능한 곳</span></div>
          <p className="quiet-note">서두르지 않아도 괜찮아요.<br />좋은 발견은 작은 호기심에서 시작되니까요.</p>
        </aside>
      </div>
      <footer className="lab-footer"><span>BUILD. LEARN. DISCOVER.</span><span>나만의 기술 연구 공간</span></footer>
    </main>
  )
}

export default App
