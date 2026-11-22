import { useEffect, useRef, useState } from 'react'
import type { TradeOffer } from '../multiplayer/model/protocol'
import { inventoryStore, useInventory } from './inventoryStore'
import { FISH_COLORS } from '../../game/rooms/fishingLogic'
import { playSfx } from '../../audio/AudioManager'
import '../research/components/ResearchPanel.css'
import './inventory.css'

const swatch = (name: string) => `#${(FISH_COLORS[name] ?? 0xffffff).toString(16).padStart(6, '0')}`
const label = (item: { name: string; sizeCm: number | null }) => item.sizeCm ? `${item.name} ${item.sizeCm}cm` : item.name

/**
 * 회의실에서 받은 교환 신청. 상대가 내놓은 아이템을 보고, 내 가방에서 하나 골라 맞바꾸거나 거절한다. 60초가 지나면 닫힌다.
 *
 * @author seulgae
 * @version 1.0, 회의실 아이템 교환
 * @see "None"
 * @param props 받은 신청, 답하기(내 아이템 id, 거절이면 null), 닫기
 * @returns 교환 신청 모달
 */
export default function TradeOfferPanel({ offer, onAnswer, onClose }: { offer: TradeOffer; onAnswer: (itemId: string | null) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inventory = useInventory()
  const [picked, setPicked] = useState<string | null>(null)
  const [left, setLeft] = useState(Math.round(offer.expiresInMs / 1000))

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); void inventoryStore.refresh(); playSfx('notify', { volume: 0.6 }); return () => dialog?.close() }, [])
  useEffect(() => {
    const timer = setInterval(() => setLeft(seconds => {
      if (seconds <= 1) { clearInterval(timer); onClose(); return 0 }
      return seconds - 1
    }), 1000)
    return () => clearInterval(timer)
  }, [onClose])

  return (
    <dialog ref={dialogRef} className="research-panel inventory-panel trade-panel" aria-labelledby="trade-title"
      onCancel={event => { event.preventDefault(); onAnswer(null) }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">TRADE · {left}초</p>
          <h2 id="trade-title">교환 신청</h2>
        </div>
      </header>
      <div className="trade-offer">
        <span className="inventory-fish" style={{ background: swatch(offer.item.name) }} aria-hidden="true" />
        <p><strong>{offer.from.nickname}</strong>님이 <strong>{label(offer.item)}</strong>을(를) 내밀며 교환을 신청했어요.</p>
      </div>
      <p className="inventory-note">내 물고기 보관함에서 줄 아이템을 하나 골라 주세요.</p>
      {inventory.loaded && inventory.items.length === 0 && <p className="inventory-note">가방이 비어 있어 교환할 수 없어요.</p>}
      <ul className="inventory-grid">
        {inventory.items.map(item => (
          <li key={item.id} className={picked === item.id ? 'trade-picked' : undefined}>
            <span className="inventory-fish" style={{ background: swatch(item.name) }} aria-hidden="true" />
            <strong>{item.name}</strong>
            {item.sizeCm && <small>{item.sizeCm}cm</small>}
            <button type="button" aria-pressed={picked === item.id} onClick={() => setPicked(item.id)}>{picked === item.id ? '선택됨' : '고르기'}</button>
          </li>
        ))}
      </ul>
      <div className="trade-actions">
        <button type="button" onClick={() => onAnswer(null)}>거절</button>
        <button type="button" className="board-primary" disabled={!picked} onClick={() => picked && onAnswer(picked)}>맞바꾸기</button>
      </div>
    </dialog>
  )
}
