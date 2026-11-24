import { useEffect, useState } from 'react'
import { inventoryStore } from '../../inventory/inventoryStore'
import { playSfx } from '../../../audio/AudioManager'
import { STOCK_MAX_QUANTITY, buyStock, fetchStocks, profitOf, sellStock } from '../phoneApi'
import type { StockQuote, StockView } from '../phoneApi'

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '요청에 실패했어요.'
const signed = (value: number, unit = '') => `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}${unit}`

/**
 * 폰 주식 앱: 가상 종목 시세(10분마다 변동)와 작은 차트, 사고팔기, 내 주식 평가 손익.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see "None"
 * @returns 주식 화면
 */
export default function StockApp() {
  const [view, setView] = useState<StockView | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  /* 처음 열 때와, 다음 시세 변동 시각이 되면 다시 읽는다. */
  useEffect(() => {
    let timer = 0
    const load = () => fetchStocks().then(next => {
      setView(next)
      timer = window.setTimeout(load, Math.max(5, next.nextTickSeconds + 2) * 1000)
    }).catch(cause => setError(errorText(cause)))
    void load()
    return () => window.clearTimeout(timer)
  }, [])

  const stock = view?.stocks.find(entry => entry.code === picked)
  const holding = view?.holdings.find(entry => entry.code === picked)
  const count = Number(quantity)
  const validCount = Number.isInteger(count) && count >= 1 && count <= STOCK_MAX_QUANTITY

  const trade = async (side: 'buy' | 'sell') => {
    if (!stock || !validCount || busy) return
    const total = stock.price * count
    if (!window.confirm(`${stock.name} ${count}주를 ${total.toLocaleString('ko-KR')}원에 ${side === 'buy' ? '살' : '팔'}까요?`)) return
    setBusy(true)
    try {
      setView(await (side === 'buy' ? buyStock : sellStock)(stock.code, count))
      setMessage(`${stock.name} ${count}주를 ${side === 'buy' ? '샀' : '팔았'}어요.`); setError(null)
      playSfx('coin', { volume: 0.6 })
      void inventoryStore.refresh()
    } catch (cause) { setError(errorText(cause)); setMessage(null) } finally { setBusy(false) }
  }

  const value = view?.holdings.reduce((sum, held) => sum + held.quantity * (view.stocks.find(entry => entry.code === held.code)?.price ?? 0), 0) ?? 0
  const cost = view?.holdings.reduce((sum, held) => sum + held.totalCost, 0) ?? 0

  return (
    <div className="phone-app-body">
      {view && (
        <section className="phone-card bank-balance" aria-label="내 주식">
          <small>평가 금액 · 현금 {view.coins.toLocaleString('ko-KR')}원</small>
          <strong>{value.toLocaleString('ko-KR')}원</strong>
          <small>손익 {value - cost >= 0 ? '▲' : '▼'} {signed(value - cost, '원')} · 다음 시세 {Math.ceil(view.nextTickSeconds / 60)}분 뒤</small>
        </section>
      )}
      {error && <p className="phone-error" role="alert">{error}</p>}
      {message && <p className="phone-note" role="status">{message}</p>}
      {!view && !error && <p className="phone-note">시세를 불러오는 중…</p>}

      {/* 선택한 종목: 차트와 사고팔기 */}
      {view && stock && (
        <section className="phone-card stock-detail" aria-label={`${stock.name} 거래`}>
          <header><strong>{stock.name}</strong> <small>{stock.code} · {stock.summary}</small></header>
          <Sparkline quote={stock} wide />
          <p className="stock-price">{stock.price.toLocaleString('ko-KR')}원 <span className={stock.changePct >= 0 ? 'plus' : 'minus'}>{signed(stock.changePct, '%')}</span></p>
          {holding && <small className="phone-muted">보유 {holding.quantity}주 · 평균 {Math.round(holding.totalCost / holding.quantity)}원 · 손익 {signed(profitOf(holding, stock.price), '원')}</small>}
          <form className="phone-inline-form" onSubmit={event => event.preventDefault()}>
            <input aria-label="수량" inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 3))} />
            <button type="button" className="phone-primary" disabled={busy || !validCount || stock.price * count > view.coins} onClick={() => void trade('buy')}>사기</button>
            <button type="button" disabled={busy || !validCount || (holding?.quantity ?? 0) < count} onClick={() => void trade('sell')}>팔기</button>
          </form>
          <small className="phone-muted">합계 {validCount ? (stock.price * count).toLocaleString('ko-KR') : '-'}원 · 오늘 거래 {view.tradesLeftToday}번 남음</small>
        </section>
      )}

      {view && (
        <ul className="stock-list" aria-label="종목">
          {view.stocks.map(quote => {
            const held = view.holdings.find(entry => entry.code === quote.code)
            return (
              <li key={quote.code}>
                <button type="button" aria-pressed={picked === quote.code} onClick={() => setPicked(quote.code === picked ? null : quote.code)}>
                  <span className="stock-name">{quote.name}<small>{held ? `${held.quantity}주 보유` : quote.code}</small></span>
                  <Sparkline quote={quote} />
                  <span className="stock-quote">{quote.price.toLocaleString('ko-KR')}<small className={quote.changePct >= 0 ? 'plus' : 'minus'}>{signed(quote.changePct, '%')}</small></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="phone-muted">가상 회사의 가상 시세예요. 게임 동전으로만 사고팔아요.</p>
    </div>
  )
}

/**
 * 작은 시세 차트(오를수록 위). 처음보다 오르면 빨강, 내리면 파랑(한국식).
 *
 * @param props 종목, 넓게 그릴지
 * @returns SVG 차트
 */
function Sparkline({ quote, wide = false }: { quote: StockQuote; wide?: boolean }) {
  const width = wide ? 240 : 64, height = wide ? 60 : 24
  const points = quote.history.length > 1 ? quote.history : [quote.price, quote.price]
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const line = points.map((price, index) => `${(index / (points.length - 1) * width).toFixed(1)},${(height - 2 - (price - min) / span * (height - 4)).toFixed(1)}`).join(' ')
  const up = points[points.length - 1]! >= points[0]!
  return (
    <svg className="stock-spark" viewBox={`0 0 ${width} ${height}`} width={wide ? '100%' : width} height={height} aria-hidden="true">
      <polyline points={line} fill="none" stroke={up ? '#e5484d' : '#3b82f6'} strokeWidth={wide ? 2 : 1.5} />
    </svg>
  )
}
