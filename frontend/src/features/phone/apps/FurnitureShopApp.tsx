import { useEffect, useState } from 'react'
import { inventoryStore } from '../../inventory/inventoryStore'
import { playSfx } from '../../../audio/AudioManager'
import { FURNITURE_ICONS, buyFurniture, fetchDorm, requestPlacement, storeFurniture } from '../../dorm/dormApi'
import type { DormView } from '../../dorm/dormApi'

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '요청에 실패했어요.'

/**
 * 폰 가구점 앱: 상점에서 동전으로 가구를 사면 보관함에 들어간다.
 * 보관함 탭에서 배치를 누르면 폰이 닫히고 개인 기숙사에서 놓을 자리를 고른다. 놓인 가구는 보관을 눌러 되돌린다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 * @param props 폰 닫기 콜백
 * @returns 가구점 화면
 */
export default function FurnitureShopApp({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<DormView | null>(null)
  const [tab, setTab] = useState<'shop' | 'storage'>('shop')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchDorm().then(setView).catch(cause => setError(errorText(cause))) }, [])

  /* 서버 요청 하나를 실행하고 결과·안내를 보여 준다. */
  const run = async (action: () => Promise<DormView>, done: string) => {
    if (busy) return false
    setBusy(true)
    try { setView(await action()); setMessage(done); setError(null); void inventoryStore.refresh(); return true }
    catch (cause) { setError(errorText(cause)); setMessage(null); return false }
    finally { setBusy(false) }
  }

  const buy = async (code: string, name: string, price: number) => {
    if (!window.confirm(`${name}을(를) ${price}원에 살까요?`)) return
    if (await run(() => buyFurniture(code), `${name}을(를) 샀어요. 보관함에 들어갔어요.`)) playSfx('coin', { volume: 0.6 })
  }

  const place = (id: string) => {
    requestPlacement(id)
    onClose()
  }

  const name = (code: string) => view?.catalog.find(entry => entry.code === code)?.name ?? code
  const icon = (code: string) => FURNITURE_ICONS[code] ?? '📦'
  const stored = view?.furniture.filter(item => !item.placed) ?? []
  const placed = view?.furniture.filter(item => item.placed) ?? []

  return (
    <div className="phone-app-body">
      <div className="phone-tabs" role="tablist" aria-label="가구점">
        <button type="button" role="tab" aria-selected={tab === 'shop'} onClick={() => setTab('shop')}>상점</button>
        <button type="button" role="tab" aria-selected={tab === 'storage'} onClick={() => setTab('storage')}>보관함{view ? ` ${view.furniture.length}` : ''}</button>
      </div>
      {error && <p className="phone-error" role="alert">{error}</p>}
      {message && <p className="phone-note" role="status">{message}</p>}
      {!view && !error && <p className="phone-note">불러오는 중…</p>}

      {/* 상점: 가구 카드(이름·충돌 여부·가격) */}
      {view && tab === 'shop' && (
        <ul className="furniture-list" aria-label="가구 목록">
          {view.catalog.map(item => (
            <li key={item.code} className="phone-card furniture-card">
              <span className="furniture-icon" aria-hidden="true">{icon(item.code)}</span>
              <span className="furniture-name">{item.name}<small>{item.blocking ? '부딪혀요' : '밟고 지나가요'}</small></span>
              <button type="button" disabled={busy || view.coins < item.price} onClick={() => void buy(item.code, item.name, item.price)} aria-label={`${item.name} ${item.price}원에 사기`}>🪙 {item.price}</button>
            </li>
          ))}
        </ul>
      )}

      {/* 보관함: 보관 중인 가구는 배치, 방에 놓인 가구는 보관 */}
      {view && tab === 'storage' && (
        <>
          {view.furniture.length === 0 && <p className="phone-note">아직 산 가구가 없어요. 상점에서 골라 봐요.</p>}
          {stored.length > 0 && <p className="phone-note">배치를 누르면 개인 기숙사(로비 오른쪽 아래 방)에서 놓을 자리를 골라요.</p>}
          <ul className="furniture-list" aria-label="내 가구">
            {stored.map(item => (
              <li key={item.id} className="phone-card furniture-card">
                <span className="furniture-icon" aria-hidden="true">{icon(item.code)}</span>
                <span className="furniture-name">{name(item.code)}<small>보관 중</small></span>
                <button type="button" disabled={busy} onClick={() => place(item.id)}>배치</button>
              </li>
            ))}
            {placed.map(item => (
              <li key={item.id} className="phone-card furniture-card">
                <span className="furniture-icon" aria-hidden="true">{icon(item.code)}</span>
                <span className="furniture-name">{name(item.code)}<small>방에 놓임</small></span>
                <button type="button" disabled={busy} onClick={() => void run(() => storeFurniture(item.id), `${name(item.code)}을(를) 보관함에 넣었어요.`)}>보관</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
