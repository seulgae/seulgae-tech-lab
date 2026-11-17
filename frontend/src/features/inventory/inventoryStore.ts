import { useSyncExternalStore } from 'react'

/**
 * 가방(인벤토리) 상태. 로그인 회원만 쓸 수 있고, 서버(/api/inventory)가 원본이다.
 * 동전이 늘면 화면(게임 장면)에 동전 연출을 하도록 window 이벤트(COIN_EVENT)를 보낸다.
 */
export type InventoryItem = { id: string; kind: string; name: string; sizeCm: number | null; createdAt: string }
export type InventoryState = { loaded: boolean; available: boolean; coins: number; items: InventoryItem[]; rewardsLeftToday: number }
export const COIN_EVENT = 'lab:coin'
export const INVENTORY_KEY = 'I'
/** 화면 위 가방 버튼이 게임 장면에 "가방 열기"를 요청하는 window 이벤트 */
export const OPEN_INVENTORY_EVENT = 'lab:open-inventory'

let state: InventoryState = { loaded: false, available: false, coins: 0, items: [], rewardsLeftToday: 0 }
const listeners = new Set<() => void>()
const set = (next: InventoryState) => { state = next; listeners.forEach(listener => listener()) }

async function call(path: string, init: RequestInit = {}) {
  return fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
}

function apply(view: { coins: number; items: InventoryItem[]; rewardsLeftToday: number }) {
  const gained = state.loaded && state.available ? view.coins - state.coins : 0
  set({ loaded: true, available: true, coins: view.coins, items: view.items, rewardsLeftToday: view.rewardsLeftToday })
  if (gained !== 0) globalThis.dispatchEvent?.(new CustomEvent(COIN_EVENT, { detail: { amount: gained } }))
}

export const inventoryStore = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  /** 서버에서 다시 읽는다. 로그인하지 않았으면 가방을 쓸 수 없는 상태가 된다. */
  async refresh() {
    try {
      const response = await call('/api/inventory')
      if (response.status === 401) { set({ ...state, loaded: true, available: false }); return state }
      if (!response.ok) return state
      apply(await response.json())
    } catch { /* 연결 문제는 다음에 다시 */ }
    return state
  },
  /** 낚은 물고기를 가방에 넣는다. @returns 넣었으면 true(비회원·가방 가득·잘못된 물고기는 false) */
  async storeFish(species: string, cm: number) {
    try {
      const response = await call('/api/inventory/fish', { method: 'POST', body: JSON.stringify({ species, cm }) })
      if (!response.ok) { if (response.status === 401) set({ ...state, loaded: true, available: false }); return false }
      apply(await response.json())
      return true
    } catch { return false }
  },
  /** 오락실 한 판(1원). 'paid' 냈음, 'free' 비회원 무료, 'broke' 동전 부족 */
  async payArcade(): Promise<'paid' | 'free' | 'broke'> {
    try {
      const response = await call('/api/inventory/arcade', { method: 'POST' })
      if (response.status === 401) return 'free'
      if (response.status === 409) return 'broke'
      if (!response.ok) return 'free'
      const { coins } = await response.json() as { coins: number }
      set({ ...state, coins })
      globalThis.dispatchEvent?.(new CustomEvent(COIN_EVENT, { detail: { amount: -1 } }))
      return 'paid'
    } catch { return 'free' }
  },
}

export function useInventory() { return useSyncExternalStore(inventoryStore.subscribe, inventoryStore.get) }
