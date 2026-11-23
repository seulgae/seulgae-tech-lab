import { useEffect, useRef, useState } from 'react'
import { LOGIN_URL, useAuth } from '../auth/authStore'
import type MultiplayerClient from '../multiplayer/MultiplayerClient'
import { inventoryStore, useInventory } from '../inventory/inventoryStore'
import { playSfx } from '../../audio/AudioManager'
import { clockText } from './phoneTime'
import { PHONE_APPS } from './phoneApps'
import type { PhoneAppId } from './phoneApps'
import FishBoxApp from './apps/FishBoxApp'
import BankApp from './apps/BankApp'
import CalendarApp from './apps/CalendarApp'
import BrowserApp from './apps/BrowserApp'
import SnsApp from './apps/SnsApp'
import '../../components/panel.css'
import '../inventory/inventory.css'
import './phone.css'

/**
 * I 키 폰: 홈 화면(상태 위젯 + 앱 아이콘)에서 앱을 눌러 연다. 앱에서 ESC나 홈 버튼을 누르면 홈으로, 홈에서 ESC면 닫힌다.
 * 물고기 보관함·은행·캘린더는 로그인 회원만, 브라우저와 SNS 읽기는 누구나 쓴다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱
 * @see "None"
 * @param props 멀티플레이 클라이언트(물고기 버리기·교환)와 닫기 콜백
 * @returns 폰 모달
 */
export default function PhonePanel({ client, onClose }: { client: () => MultiplayerClient | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inventory = useInventory()
  const auth = useAuth()
  const [app, setApp] = useState<PhoneAppId | null>(null)
  const [clock, setClock] = useState(() => clockText())

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); void inventoryStore.refresh(); return () => dialog?.close() }, [])
  useEffect(() => { const timer = window.setInterval(() => setClock(clockText()), 15_000); return () => window.clearInterval(timer) }, [])

  const open = (id: PhoneAppId) => { setApp(id); playSfx('click', { volume: 0.5 }) }
  const home = () => { setApp(null); playSfx('click', { volume: 0.4 }) }
  const current = PHONE_APPS.find(entry => entry.id === app)
  const member = !!auth.member
  const locked = current?.memberOnly && !member

  return (
    <dialog ref={dialogRef} className="phone-panel" aria-labelledby="phone-title"
      onCancel={event => { event.preventDefault(); if (app) home(); else onClose() }}>
      <div className="phone-screen" onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation() }}>
        <div className="phone-status" aria-hidden="true">
          <span>{clock}</span>
          <span className="phone-notch" />
          <span>{inventory.available ? `🪙 ${inventory.coins.toLocaleString('ko-KR')}` : '▮▮▮'}</span>
        </div>

        {!current && (
          <div className="phone-home">
            <h2 id="phone-title" className="phone-sr">슬개폰</h2>
            {inventory.available ? (
              <section className="phone-widget" aria-label="내 상태">
                {([['HP', inventory.hp, inventory.hpMax, 'hp'], ['피로도', inventory.fatigue, inventory.fatigueMax, 'fatigue']] as const).map(([label, value, max, key]) => (
                  <div key={key} className={`inventory-vital vital-${key}`}>
                    <span>{label}</span>
                    <span className="inventory-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
                      <span style={{ width: `${Math.round(value / max * 100)}%` }} />
                    </span>
                    <strong>{value}/{max}</strong>
                  </div>
                ))}
                <small>일·오락 한 번에 HP -3, 피로도 -5 · 게시물 보상 오늘 {inventory.rewardsLeftToday}번 남음</small>
              </section>
            ) : (
              <section className="phone-widget phone-login" aria-label="로그인">
                <p>로그인하면 물고기 보관함·은행·캘린더를 쓸 수 있어요.</p>
                <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a>
              </section>
            )}
            <ul className="phone-apps" aria-label="앱">
              {PHONE_APPS.map(entry => (
                <li key={entry.id}>
                  <button type="button" onClick={() => open(entry.id)} aria-label={`${entry.name} 열기`}>
                    <span className={`phone-icon icon-${entry.id}`} aria-hidden="true">{entry.icon}</span>
                    <span>{entry.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {current && (
          <div className="phone-app">
            <header className="phone-app-header">
              <button type="button" onClick={home} aria-label="홈으로">‹</button>
              <h2 id="phone-title">{current.name}</h2>
            </header>
            {locked ? (
              <div className="phone-app-body"><p className="phone-note">{current.name}은(는) 로그인한 연구원만 쓸 수 있어요.</p><a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></div>
            ) : (
              <>
                {app === 'fish' && <FishBoxApp client={client} />}
                {app === 'bank' && <BankApp />}
                {app === 'calendar' && <CalendarApp />}
                {app === 'browser' && <BrowserApp />}
                {app === 'sns' && <SnsApp canWrite={member} />}
              </>
            )}
          </div>
        )}

        <div className="phone-nav">
          <button type="button" className="phone-home-button" onClick={() => (app ? home() : onClose())} aria-label={app ? '홈으로' : '폰 닫기'} autoFocus />
        </div>
      </div>
      <p className="phone-hint">I 키나 폰 버튼으로 열고, ESC로 홈·닫기</p>
    </dialog>
  )
}
