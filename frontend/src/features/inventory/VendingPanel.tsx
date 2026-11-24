import { useEffect, useRef, useState } from 'react'
import { LOGIN_URL } from '../auth/authStore'
import { inventoryStore, useInventory } from './inventoryStore'
import { gainText, rulesStore, snackOf, useRules } from '../rules/rulesStore'
import { playSfx } from '../../audio/AudioManager'
import '../../components/panel.css'
import './inventory.css'
import './vending.css'

/**
 * 로비 자판기에서 음료·간식(운영 DB tb_lab_snack, place = VENDING)을 골라 구매하고 즉시 먹는 창이다.
 * 가격과 회복은 서버에서 확정하며 로그인·잔액 부족·회복 불필요 상태를 안내한다.
 * @author seulgae
 * @version 1.1, 도시락·에너지드링크와 규칙 테이블
 * @see "None"
 * @param props 닫기 콜백
 * @returns 음료 선택 모달
 */
export default function VendingPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buyingRef = useRef(false)
  const inventory = useInventory()
  const rules = useRules()
  /* 자판기 음료 목록·가격·회복량은 운영 DB(tb_lab_snack, place=VENDING)에서 */
  const drinks = rules.snacks.filter(snack => snack.place === 'VENDING')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('마실 음료를 골라 주세요. 구매하면 바로 마셔요!')
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    void inventoryStore.refresh()
    void rulesStore.load()
    return () => dialog?.close()
  }, [])

  /** 선택한 음료를 한 번 구매하고 서버가 확정한 결과를 알린다.
   * @param kind 구매할 음료 종류
   */
  const buy = async (kind: string) => {
    if (buyingRef.current) return
    buyingRef.current = true
    setBusy(kind)
    const result = await inventoryStore.buySnack(kind)
    buyingRef.current = false
    setBusy(null)
    if (result === 'bought') {
      const now = inventoryStore.get()
      const snack = snackOf(kind)
      const eat = snack && snack.hpGain > 0
      setMessage(`${snack?.name ?? '음료'} ${eat ? '하나, 든든하게 먹었어요' : '한 잔, 시원하게 마셨어요'}! HP ${now.hp}/${now.hpMax} · 기력 ${now.fatigue}/${now.fatigueMax}`)
      playSfx('coin', { volume: 0.6 })
      return
    }
    setMessage({ guest: '로그인 후 동전으로 구매할 수 있어요.', broke: '동전이 부족해요.', full: '이미 가득해서 회복할 게 없어요. 동전은 쓰지 않았어요.', error: '구매 결과를 확인하지 못했어요. 잔액을 확인한 뒤 다시 이용해 주세요.' }[result])
    void inventoryStore.refresh()
  }

  return (
    <dialog ref={dialogRef} className="research-panel inventory-panel vending-panel" aria-labelledby="vending-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div><p className="research-eyebrow">잠깐의 시원한 휴식</p><h2 id="vending-title">간식·음료 자판기</h2></div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <p className="inventory-note" role="status">{message}</p>
      <p className="inventory-note">내 동전 <strong>{inventory.available ? `${inventory.coins}원` : '—'}</strong> · HP {inventory.unlimited ? '∞' : `${inventory.hp}/${inventory.hpMax}`} · 기력 {inventory.unlimited ? '∞' : `${inventory.fatigue}/${inventory.fatigueMax}`}</p>
      {inventory.loaded && !inventory.available && <p className="inventory-note"><a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a> 후 구매해 주세요.</p>}
      <div className="vending-drinks">
        {drinks.map(drink => (
          <button type="button" className={`vending-drink vending-${drink.code.toLowerCase()}`} key={drink.code} disabled={!inventory.available || busy !== null} onClick={() => void buy(drink.code)}>
            <span className="vending-can" aria-hidden="true">{drink.code === 'WATER' ? '물' : drink.hpGain > 0 ? '🍱' : drink.fatigueGain >= 10 ? '⚡' : '톡!'}</span>
            <strong>{drink.name} · {drink.price}원</strong>
            <small>{busy === drink.code ? '꺼내는 중…' : gainText(drink)}</small>
          </button>
        ))}
      </div>
      <p className="research-footer">구매 즉시 먹고 마셔요. 회복할 게 없으면 동전을 받지 않아요. ESC로 닫아요.</p>
    </dialog>
  )
}
