import { useSyncExternalStore } from 'react'
import { costText, tiredMessage } from '../rules/rulesStore.ts'

/**
 * 가방(인벤토리) 상태. 로그인 회원만 쓸 수 있고, 서버(/api/inventory)가 원본이다.
 * 동전이 늘면 화면(게임 장면)에 동전 연출을 하도록 window 이벤트(COIN_EVENT)를 보낸다.
 */
export type InventoryItem = { id: string; kind: string; name: string; sizeCm: number | null; createdAt: string }
export type Vitals = { hp: number; hpMax: number; fatigue: number; fatigueMax: number }
/** unlimited: 연구소장이라 HP·기력이 줄지 않음(화면에 ∞) */
export type InventoryState = { loaded: boolean; available: boolean; coins: number; items: InventoryItem[]; rewardsLeftToday: number; unlimited: boolean } & Vitals
type InventoryView = { coins: number; items: InventoryItem[]; rewardsLeftToday: number; unlimited?: boolean } & Partial<Vitals>
export const COIN_EVENT = 'lab:coin'
/** HP·기력이 바뀌면 게임 장면에 변화량을 띄우는 window 이벤트(detail: { hp, fatigue }) */
export const VITALS_EVENT = 'lab:vitals'
/** 간식·음료 코드(가격·회복량·행동 비용은 운영 DB 규칙: features/rules/rulesStore) */
export type SnackKind = string
/** HP·기력이 모자라 일·오락을 할 수 없을 때 서버 응답(423). 안내는 tiredMessage(행동 코드) */
export const TIRED_STATUS = 423
/** 오락실 메인 오락기 하루 판 수(네 게임 합쳐, 서버 InventoryService.DAILY_ARCADE_PLAYS와 같은 값) */
export const ARCADE_DAILY_PLAYS = 5
export type ArcadePay = 'paid' | 'free' | 'broke' | 'tired' | 'limit'

/**
 * 오락실 동전 넣기 결과 안내 문구.
 *
 * @param result 결과
 * @param playsLeft 오늘 남은 판(모르면 null)
 * @returns 안내 한 줄
 */
export function arcadeNotice(result: ArcadePay, playsLeft: number | null): string {
  const left = playsLeft === null ? '' : ` · 오늘 ${playsLeft}판 남음`
  return {
    paid: `동전 1원을 넣었어요(${costText('ARCADE_PLAY')})${left}. 행운을 빌어요!`,
    free: '비회원은 무료로 즐겨요.',
    broke: '동전이 부족해요. 사무실 게시판에 글을 등록하면 10원을 받아요.',
    tired: tiredMessage('ARCADE_PLAY'),
    limit: `오늘 오락실 ${ARCADE_DAILY_PLAYS}판을 다 했어요. 내일 다시 와요!`,
  }[result]
}

/** 시작 전 안내: 한 판 값과 오늘 남은 판 */
export const arcadeIntro = (playsLeft: number | null) =>
  `회원은 한 판에 1원(${costText('ARCADE_PLAY')}), 하루 ${ARCADE_DAILY_PLAYS}판${playsLeft === null ? '' : ` · 오늘 ${playsLeft}판 남음`}. Space·탭으로 시작해요.`
export const INVENTORY_KEY = 'I'
/** 화면 위 가방 버튼이 게임 장면에 "가방 열기"를 요청하는 window 이벤트 */
export const OPEN_INVENTORY_EVENT = 'lab:open-inventory'

const FULL: Vitals = { hp: 50, hpMax: 50, fatigue: 50, fatigueMax: 50 }
let state: InventoryState = { loaded: false, available: false, coins: 0, items: [], rewardsLeftToday: 0, unlimited: false, ...FULL }
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
  set({ loaded: true, available: true, coins: view.coins, items: view.items, rewardsLeftToday: view.rewardsLeftToday, unlimited: view.unlimited === true, ...vitals })
  if (gained !== 0) globalThis.dispatchEvent?.(new CustomEvent(COIN_EVENT, { detail: { amount: gained } }))
  if (hp !== 0 || fatigue !== 0) globalThis.dispatchEvent?.(new CustomEvent(VITALS_EVENT, { detail: { hp, fatigue } }))
}

/** 변화량 표시 문구(예: "HP -3 · 기력 -5") */
export function vitalsText(change: { hp: number; fatigue: number }) {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  return [change.hp ? `HP ${sign(change.hp)}` : '', change.fatigue ? `기력 ${sign(change.fatigue)}` : ''].filter(Boolean).join(' · ')
}

export const inventoryStore = {
  get: () => state,
  /** 테스트용: 아직 가방을 읽지 않은 처음 상태로 되돌린다. */
  reset() { state = { loaded: false, available: false, coins: 0, items: [], rewardsLeftToday: 0, unlimited: false, ...FULL } },
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
  /** 낚은 물고기를 가방에 넣는다(기력이 든다). @returns 넣었으면 true, 기력이 모자라면 'tired'(비회원·가방 가득·잘못된 물고기는 false) */
  async storeFish(species: string, cm: number): Promise<boolean | 'tired'> {
    try {
      const response = await call('/api/inventory/fish', { method: 'POST', body: JSON.stringify({ species, cm }) })
      if (response.status === TIRED_STATUS) return 'tired'
      if (!response.ok) { if (response.status === 401) set({ ...state, loaded: true, available: false }); return false }
      apply(await response.json())
      return true
    } catch { return false }
  },
  /** 오락실 한 판(1원, HP·기력은 ARCADE_PLAY 규칙, 하루 5판). 'paid' 냈음, 'free' 비회원 무료, 'broke' 동전 부족, 'tired' 기력 부족, 'limit' 오늘 다 함 */
  async payArcade(): Promise<ArcadePay> {
    try {
      const response = await call('/api/inventory/arcade', { method: 'POST' })
      if (response.status === 401) return 'free'
      if (response.status === 409) return 'broke'
      if (response.status === TIRED_STATUS) return 'tired'
      if (response.status === 429) return 'limit'
      if (!response.ok) return 'free'
      await inventoryStore.refresh()
      return 'paid'
    } catch { return 'free' }
  },
  /** 오늘 남은 오락실 판 수(비회원·연결 문제면 null) */
  async arcadePlaysLeft(): Promise<number | null> {
    try {
      const response = await call('/api/inventory/arcade')
      if (!response.ok) return null
      const body = await response.json() as { playsLeftToday?: unknown }
      return typeof body.playsLeftToday === 'number' ? body.playsLeftToday : null
    } catch { return null }
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
      // 가방을 아직 안 읽었으면 먼저 읽어 둔다: 그래야 마신 뒤 '기력 +5' 변화량을 계산해 띄울 수 있다.
      if (!state.loaded) await inventoryStore.refresh()
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
