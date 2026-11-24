import { useEffect, useState } from 'react'
import { inventoryStore } from '../../inventory/inventoryStore'
import { playSfx } from '../../../audio/AudioManager'
import { depositSavings, fetchSavings, savingsPayout, withdrawSavings } from '../phoneApi'
import type { SavingsView } from '../phoneApi'

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '요청에 실패했어요.'
const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * 은행 앱의 적금: 기간(1·3·7일)을 골라 넣고, 만기에 원금+이자를 찾는다. 만기 전에 찾으면 원금만 돌려받는다.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 * @param props 잔액이 바뀌면 부르는 콜백(통장 화면 새로고침)
 * @returns 적금 카드
 */
export default function SavingsSection({ onChanged }: { onChanged: () => void }) {
  const [view, setView] = useState<SavingsView | null>(null)
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { fetchSavings().then(setView).catch(cause => setError(errorText(cause))) }, [])

  /* 서버 요청 하나를 실행하고 통장·가방 잔액도 새로 읽는다. */
  const run = async (action: () => Promise<SavingsView>, done: string) => {
    if (busy) return
    setBusy(true)
    try { setView(await action()); setMessage(done); setError(null); onChanged(); void inventoryStore.refresh(); playSfx('coin', { volume: 0.6 }) }
    catch (cause) { setError(errorText(cause)); setMessage(null) }
    finally { setBusy(false) }
  }

  const value = Number(amount)
  const open = view?.savings.filter(item => !item.closedAt) ?? []
  const rate = view?.terms.find(term => term.days === days)?.ratePct ?? 0
  const valid = !!view && Number.isInteger(value) && value >= 1 && value <= view.maxAmount && value <= view.coins && open.length < view.maxOpen
  const now = new Date()

  const deposit = () => {
    if (!valid) return
    if (!window.confirm(`${value}원을 ${days}일 적금에 넣을까요? 만기에 ${value + Math.floor(value * rate / 100)}원을 받아요. 만기 전에 찾으면 원금만 돌려받아요.`)) return
    void run(() => depositSavings(value, days), `${days}일 적금에 ${value}원을 넣었어요.`).then(() => setAmount(''))
  }

  const withdraw = (id: string, matured: boolean, payout: number) => {
    if (!matured && !window.confirm(`아직 만기 전이에요. 지금 찾으면 이자 없이 원금 ${payout}원만 받아요. 해지할까요?`)) return
    void run(() => withdrawSavings(id), `${payout}원을 찾았어요.`)
  }

  return (
    <section className="phone-card" aria-label="적금">
      <h3>적금</h3>
      {error && <p className="phone-error" role="alert">{error}</p>}
      {message && <p className="phone-note" role="status">{message}</p>}
      {view && (
        <>
          <div className="phone-tabs" role="radiogroup" aria-label="적금 기간">
            {view.terms.map(term => (
              <button key={term.days} type="button" role="radio" aria-checked={days === term.days} onClick={() => setDays(term.days)}>{term.days}일 · {term.ratePct}%</button>
            ))}
          </div>
          <form className="phone-inline-form" onSubmit={event => { event.preventDefault(); deposit() }}>
            <input aria-label="적금 넣을 금액" inputMode="numeric" placeholder={`1~${view.maxAmount}원`} value={amount}
              onChange={event => setAmount(event.target.value.replace(/\D/g, '').slice(0, 4))} />
            <button type="submit" className="phone-primary" disabled={!valid || busy}>넣기</button>
          </form>
          <small className="phone-muted">동시에 {view.maxOpen}개까지 · 지금 {open.length}개</small>
          <ul className="bank-history">
            {view.savings.map(item => {
              const matured = now >= new Date(item.maturesAt)
              const payout = savingsPayout(item, now)
              return (
                <li key={item.id}>
                  <span>{item.principal}원 · {item.termDays}일 {item.ratePct}%
                    <small>{item.closedAt ? `${when(item.closedAt)} 찾음` : matured ? '만기! 찾을 수 있어요' : `${when(item.maturesAt)} 만기`}</small>
                  </span>
                  {item.closedAt
                    ? <strong className="plus">+{item.payout}원</strong>
                    : <button type="button" disabled={busy} onClick={() => withdraw(item.id, matured, payout)}>{matured ? `${payout}원 찾기` : '해지'}</button>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
