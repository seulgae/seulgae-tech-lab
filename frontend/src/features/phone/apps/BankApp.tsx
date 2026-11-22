import { useEffect, useState } from 'react'
import { inventoryStore } from '../../inventory/inventoryStore'
import { playSfx } from '../../../audio/AudioManager'
import { TRANSFER_MAX, amountText, fetchBank, searchRecipients, transfer } from '../phoneApi'
import type { BankView, Recipient } from '../phoneApi'

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '요청에 실패했어요.'

/**
 * 폰 은행 앱: 잔액, 최근 거래 내역, 다른 연구원에게 송금(1~100원, 하루 10번).
 *
 * @author seulgae
 * @version 1.0, 폰 앱(은행)
 * @see "None"
 * @returns 은행 화면
 */
export default function BankApp() {
  const [bank, setBank] = useState<BankView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Recipient[] | null>(null)
  const [to, setTo] = useState<Recipient | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchBank().then(setBank).catch(cause => setError(errorText(cause))) }, [])

  const search = async () => {
    if (!query.trim()) return
    try { setFound(await searchRecipients(query)); setError(null) } catch (cause) { setError(errorText(cause)) }
  }

  const value = Number(amount)
  const valid = !!to && Number.isInteger(value) && value >= 1 && value <= TRANSFER_MAX && !!bank && value <= bank.coins

  const send = async () => {
    if (!to || !valid || busy) return
    if (!window.confirm(`${to.nickname}에게 ${value}원을 보낼까요? 보낸 돈은 되돌릴 수 없어요.`)) return
    setBusy(true)
    try {
      setBank(await transfer(to.id, value))
      setMessage(`${to.nickname}에게 ${value}원을 보냈어요.`)
      setAmount(''); setTo(null); setFound(null); setQuery(''); setError(null)
      playSfx('coin', { volume: 0.6 })
      void inventoryStore.refresh()
    } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }

  return (
    <div className="phone-app-body">
      <section className="phone-card bank-balance" aria-label="잔액">
        <small>슬개 은행 · 내 통장</small>
        <strong>{bank ? `${bank.coins.toLocaleString('ko-KR')}원` : '…'}</strong>
        {bank && <small>오늘 송금 {bank.transfersLeftToday}번 남음</small>}
      </section>
      {error && <p className="phone-error" role="alert">{error}</p>}
      {message && <p className="phone-note" role="status">{message}</p>}

      <section className="phone-card" aria-label="송금">
        <h3>송금하기</h3>
        {to ? (
          <p className="bank-to">받는 사람 <strong>{to.nickname}</strong> <button type="button" onClick={() => setTo(null)}>바꾸기</button></p>
        ) : (
          <form className="phone-inline-form" onSubmit={event => { event.preventDefault(); void search() }}>
            <input aria-label="받는 사람 닉네임" placeholder="닉네임 검색" maxLength={20} value={query} onChange={event => setQuery(event.target.value)} />
            <button type="submit">찾기</button>
          </form>
        )}
        {!to && found && (
          <ul className="bank-recipients">
            {found.length === 0 && <li><small>찾는 연구원이 없어요.</small></li>}
            {found.map(person => <li key={person.id}><button type="button" onClick={() => setTo(person)}>{person.nickname}</button></li>)}
          </ul>
        )}
        <form className="phone-inline-form" onSubmit={event => { event.preventDefault(); void send() }}>
          <input aria-label="보낼 금액" inputMode="numeric" placeholder={`1~${TRANSFER_MAX}원`} value={amount}
            onChange={event => setAmount(event.target.value.replace(/\D/g, '').slice(0, 3))} />
          <button type="submit" className="phone-primary" disabled={!valid || busy}>보내기</button>
        </form>
      </section>

      <section className="phone-card" aria-label="거래 내역">
        <h3>최근 거래</h3>
        {bank && bank.history.length === 0 && <p className="phone-muted">아직 거래가 없어요.</p>}
        <ul className="bank-history">
          {bank?.history.map(event => (
            <li key={event.id}>
              <span>{event.reasonName}{event.counterpart ? ` · ${event.counterpart}` : ''}<small>{new Date(event.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></span>
              <strong className={event.amount > 0 ? 'plus' : 'minus'}>{amountText(event.amount)}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
