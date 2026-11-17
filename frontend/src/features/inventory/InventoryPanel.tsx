import { useEffect, useRef, useState } from 'react'
import { LOGIN_URL } from '../auth/authStore'
import type MultiplayerClient from '../multiplayer/MultiplayerClient'
import { inventoryStore, useInventory } from './inventoryStore'
import { FISH_COLORS } from '../../game/rooms/fishingLogic'
import { playSfx } from '../../audio/AudioManager'
import '../research/components/ResearchPanel.css'
import './inventory.css'

/**
 * 가방(인벤토리): 동전과 낚은 물고기. 버리면 지금 서 있는 자리 바닥에 놓이고, 같은 방 누구나 E로 주울 수 있다.
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 * @param props 멀티플레이 클라이언트(버리기 전송)와 닫기 콜백
 * @returns 가방 모달
 */
export default function InventoryPanel({ client, onClose }: { client: () => MultiplayerClient | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inventory = useInventory()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); void inventoryStore.refresh(); return () => dialog?.close() }, [])

  const drop = (id: string, name: string) => {
    if (client()?.dropItem(id)) { playSfx('click', { volume: 0.6 }); setMessage(`${name}을(를) 바닥에 내려놓았어요. 누구나 E로 주울 수 있어요.`) }
    else setMessage('연결이 끊겨 버릴 수 없어요.')
  }

  return (
    <dialog ref={dialogRef} className="research-panel inventory-panel" aria-labelledby="inventory-title"
      onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">MY BAG</p>
          <h2 id="inventory-title">가방</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      {!inventory.loaded && <p role="status">가방을 여는 중…</p>}
      {inventory.loaded && !inventory.available && (
        <p className="inventory-note">가방은 로그인한 연구원만 쓸 수 있어요. <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>
      )}
      {inventory.available && (
        <>
          <div className="inventory-vitals">
            {([['HP', inventory.hp, inventory.hpMax, 'hp'], ['피로도', inventory.fatigue, inventory.fatigueMax, 'fatigue']] as const).map(([label, value, max, key]) => (
              <div key={key} className={`inventory-vital vital-${key}`}>
                <span>{label}</span>
                <span className="inventory-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
                  <span style={{ width: `${Math.round(value / max * 100)}%` }} />
                </span>
                <strong>{value}/{max}</strong>
              </div>
            ))}
            <small>게시판 일·오락 한 번에 HP -3, 피로도 -5 · 로비 데스크 케이크 3원(HP +10), 커피 2원(피로도 +5)</small>
          </div>
          <div className="inventory-coins">
            <span className="inventory-coin" aria-hidden="true" />
            <strong>{inventory.coins.toLocaleString('ko-KR')}원</strong>
            <small>사무실 게시물 1개당 10원 · 오늘 {inventory.rewardsLeftToday}번 더 받을 수 있어요 · 오락실 한 판 1원</small>
          </div>
          {message && <p className="inventory-note" role="status">{message}</p>}
          {inventory.items.length === 0 && <p className="inventory-note">아직 비어 있어요. 바깥 강가 데크에서 물고기를 낚아 보세요.</p>}
          <ul className="inventory-grid">
            {inventory.items.map(item => (
              <li key={item.id}>
                <span className="inventory-fish" style={{ background: `#${(FISH_COLORS[item.name] ?? 0xffffff).toString(16).padStart(6, '0')}` }} aria-hidden="true" />
                <strong>{item.name}</strong>
                {item.sizeCm && <small>{item.sizeCm}cm</small>}
                <button type="button" onClick={() => drop(item.id, item.name)}>버리기</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="research-footer">I 키나 가방 버튼으로 열고, ESC로 닫아요.</p>
    </dialog>
  )
}
