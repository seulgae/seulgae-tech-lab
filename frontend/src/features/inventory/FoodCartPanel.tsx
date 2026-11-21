import { useEffect, useRef, useState } from 'react'
import { LOGIN_URL } from '../auth/authStore'
import { inventoryStore, useInventory } from './inventoryStore'
import { FISH_PRICE_MAX, fishPrice } from './fishPrices'
import { FISH_COLORS } from '../../game/rooms/fishingLogic'
import { playSfx } from '../../audio/AudioManager'
import '../research/components/ResearchPanel.css'
import './inventory.css'

/**
 * 포장마차: 가방의 물고기를 판다. 값은 어종과 크기(cm)로 정해지고 한 마리 최대 30원이다(저녁 6시~자정).
 *
 * @author seulgae
 * @version 1.0, 바깥 포장마차
 * @see "None"
 * @param props 닫기 콜백
 * @returns 포장마차 모달
 */
export default function FoodCartPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inventory = useInventory()
  const [message, setMessage] = useState('어서 와요~ 오늘 잡은 거 있으면 좋은 값에 사 줄게요!')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); void inventoryStore.refresh(); return () => dialog?.close() }, [])

  const sell = async (id: string, name: string) => {
    if (busy) return
    setBusy(id)
    const result = await inventoryStore.sellFish(id)
    setBusy(null)
    if (typeof result === 'number') { setMessage(`${name} 잘 받았어요! ${result}원 드릴게요~`); playSfx('coin', { volume: 0.7 }); return }
    playSfx('error', { volume: 0.5 })
    setMessage(result === 'closed' ? '오늘 장사는 끝났어요. 내일 저녁 6시에 또 와요!' : result === 'login' ? '로그인한 연구원만 팔 수 있어요.' : '그 물고기는 벌써 없네요. 가방을 다시 볼까요?')
  }

  const fish = inventory.items.filter(item => item.kind === 'FISH')

  return (
    <dialog ref={dialogRef} className="research-panel inventory-panel food-cart-panel" aria-labelledby="food-cart-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">STREET FOOD CART · 18:00~24:00</p>
          <h2 id="food-cart-title">포장마차</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <p className="inventory-note food-cart-talk" role="status">{message}</p>
      {inventory.loaded && !inventory.available && (
        <p className="inventory-note">물고기를 팔려면 로그인해 주세요. <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>
      )}
      {inventory.available && (
        <>
          <p className="inventory-note">값은 어종과 크기로 정해요(한 마리 최대 {FISH_PRICE_MAX}원). 지금 내 동전: <strong>{inventory.coins}원</strong></p>
          {fish.length === 0 && <p className="inventory-note">가방에 물고기가 없어요. 데크 끝에서 낚아 와요!</p>}
          <ul className="inventory-grid">
            {fish.map(item => (
              <li key={item.id}>
                <span className="inventory-fish" style={{ background: `#${(FISH_COLORS[item.name] ?? 0xffffff).toString(16).padStart(6, '0')}` }} aria-hidden="true" />
                <strong>{item.name}</strong>
                {item.sizeCm && <small>{item.sizeCm}cm</small>}
                <button type="button" disabled={busy !== null} onClick={() => void sell(item.id, item.name)}>{busy === item.id ? '파는 중…' : `${fishPrice(item.name, item.sizeCm)}원에 팔기`}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="research-footer">ESC로 닫아요. 포장마차는 저녁 6시에 들어와서 자정에 떠나요.</p>
    </dialog>
  )
}
