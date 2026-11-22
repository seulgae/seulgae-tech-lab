import { useSyncExternalStore } from 'react'

/**
 * 가방(인벤토리) 상태. 로그인 회원만 쓸 수 있고, 서버(/api/inventory)가 원본이다.
 * 동전이 늘면 화면(게임 장면)에 동전 연출을 하도록 window 이벤트(COIN_EVENT)를 보낸다.
 */
export type InventoryItem = { id: string; kind: string; name: string; sizeCm: number | null; createdAt: string }
export type Vitals = { hp: number; hpMax: number; fatigue: number; fatigueMax: number }
export type InventoryState = { loaded: boolean; available: boolean; coins: number; items: InventoryItem[]; rewardsLeftToday: number } & Vitals
type InventoryView = { coins: number; items: InventoryItem[]; rewardsLeftToday: number } & Partial<Vitals>
export const COIN_EVENT = 'lab:coin'
/** HP·피로도가 바뀌면 게임 장면에 변화량을 띄우는 window 이벤트(detail: { hp, fatigue }) */
export const VITALS_EVENT = 'lab:vitals'
/** 일·오락 한 번에 드는 HP·피로도, 간식 가격과 회복량(서버 InventoryService와 같은 값) */
export const WORK_COST = { hp: 3, fatigue: 5 }
/** 자판기 음료 가격과 피로도 회복량. 구매 즉시 마신다. */
export const DRINKS = {
  COLA: { price: 2, hp: 0, fatigue: 5, name: '콜라' },
  CIDER: { price: 2, hp: 0, fatigue: 5, name: '사이다' },
  FANTA: { price: 2, hp: 0, fatigue: 5, name: '환타' },
  WATER: { price: 1, hp: 0, fatigue: 2, name: '물' },
} as const
export type DrinkKind = keyof typeof DRINKS
export const SNACKS = { ...DRINKS, CAKE: { price: 3, hp: 10, fatigue: 0, name: '케이크' }, COFFEE: { price: 2, hp: 0, fatigue: 5, name: '커피' } } as const
export type SnackKind = keyof typeof SNACKS
/** HP·피로도가 모자라 일·오락을 할 수 없을 때 서버 응답(423)과 안내 */
export const TIRED_STATUS = 423
export const TIRED_MESSAGE = '기운이 없어요. 로비 데스크에서 케이크(HP +10)나 커피(피로도 +5)로 회복하세요.'
export const INVENTORY_KEY = 'I'
/** 화면 위 가방 버튼이 게임 장면에 "가방 열기"를 요청하는 window 이벤트 */
export const OPEN_INVENTORY_EVENT = 'lab:open-inventory'

const FULL: Vitals = { hp: 50, hpMax: 50, fatigue: 50, fatigueMax: 50 }
let state: InventoryState = { loaded: false, available: false, coins: 0, items: [], rewardsLeftToday: 0, ...FULL }
const listeners = new Set<() => void>()
const set = (next: InventoryState) => { state = next; listeners.forEach(listener => listener()) }

async function call(path: string, init: RequestInit = {}) {
  return fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
}

function apply(view: InventoryView) {
  const known = state.loaded && state.available
  const vitals: Vitals = { hp: view.hp ?? FULL.hp, hpMax: view.hpMax ?? FULL.hpMax, fatigue: view.fatigue ?? FULL.fatigue, fatigueMax: view.fatigueMax ?? FULL.fatigueMax }
  const gained = known ? view.coins - state.coins : 0
  const hp = known ? vitals.hp - state.hp : 0
  const fatigue = known ? vitals.fatigue - state.fatigue : 0
  set({ loaded: true, available: true, coins: view.coins, items: view.items, rewardsLeftToday: view.rewardsLeftToday, ...vitals })
  if (gained !== 0) globalThis.dispatchEvent?.(new CustomEvent(COIN_EVENT, { detail: { amount: gained } }))
  if (hp !== 0 || fatigue !== 0) globalThis.dispatchEvent?.(new CustomEvent(VITALS_EVENT, { detail: { hp, fatigue } }))
}

/** 변화량 표시 문구(예: "HP -3 · 피로도 -5") */
export function vitalsText(change: { hp: number; fatigue: number }) {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  return [change.hp ? `HP ${sign(change.hp)}` : '', change.fatigue ? `피로도 ${sign(change.fatigue)}` : ''].filter(Boolean).join(' · ')
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
  /** 오락실 한 판(1원, HP -3, 피로도 -5). 'paid' 냈음, 'free' 비회원 무료, 'broke' 동전 부족, 'tired' 기운 부족 */
  async payArcade(): Promise<'paid' | 'free' | 'broke' | 'tired'> {
    try {
      const response = await call('/api/inventory/arcade', { method: 'POST' })
      if (response.status === 401) return 'free'
      if (response.status === 409) return 'broke'
      if (response.status === TIRED_STATUS) return 'tired'
      if (!response.ok) return 'free'
      await inventoryStore.refresh()
      return 'paid'
    } catch { return 'free' }
  },
  /**
   * 포장마차에 물고기를 판다(저녁 6시~자정). 받은 동전만큼 동전 연출이 나온다.
   * @returns 받은 값(원) 또는 'closed'(장사 끝) 'login'(비회원) 'gone'(이미 없음·연결 문제)
   */
  async sellFish(itemId: string): Promise<number | 'closed' | 'login' | 'gone'> {
    try {
      const response = await call('/api/inventory/sell', { method: 'POST', body: JSON.stringify({ itemId }) })
      if (response.status === 401) return 'login'
      if (response.status === 409) return 'closed'
      if (!response.ok) return 'gone'
      const sale = await response.json() as { price: number; view: Parameters<typeof apply>[0] }
      apply(sale.view)
      return sale.price
    } catch { return 'gone' }
  },
  /**
   * 화분을 흔든다. 서버가 5% 확률로 1~3원을 준다(하루 10번까지). 비회원·꽝·연결 문제는 0.
   * @returns 받은 동전
   */
  async shakePlant(): Promise<number> {
    try {
      const response = await call('/api/inventory/plant', { method: 'POST' })
      if (!response.ok) return 0
      const { won, coins } = await response.json() as { won: number; coins: number }
      if (!(won > 0)) return 0
      set({ ...state, coins })
      globalThis.dispatchEvent?.(new CustomEvent(COIN_EVENT, { detail: { amount: won } }))
      return won
    } catch { return 0 }
  },
  /**
   * 로비 데스크 간식 또는 자판기 음료를 서버 가격으로 구매해 즉시 회복한다.
   * 'bought' 샀음, 'guest' 비회원(무료로 즐기기만), 'broke' 동전 부족, 'full' 이미 가득(돈을 내지 않음), 'error' 연결 문제
   */
  async buySnack(kind: SnackKind): Promise<'bought' | 'guest' | 'broke' | 'full' | 'error'> {
    try {
      const response = await call('/api/inventory/snack', { method: 'POST', body: JSON.stringify({ kind }) })
      if (response.status === 401) { set({ ...state, loaded: true, available: false }); return 'guest' }
      if (response.status === 409) return 'broke'
      if (response.status === 422) return 'full'
      if (!response.ok) return 'error'
      apply(await response.json())
      return 'bought'
    } catch { return 'error' }
  },
}

export function useInventory() { return useSyncExternalStore(inventoryStore.subscribe, inventoryStore.get) }
