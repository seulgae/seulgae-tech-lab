import { useSyncExternalStore } from 'react'

/**
 * 게임 규칙(행동별 HP·기력 비용, 간식·음료, 직급). 운영 DB 테이블을 서버(/api/rules)에서 받아 쓴다.
 * 화면에 숫자를 따로 적어 두지 않기 위한 곳이며, 받기 전·실패 때는 V23 시드와 같은 기본값을 쓴다.
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see None
 */
export type ActionCost = { code: string; name: string; hpCost: number; fatigueCost: number; description: string }
export type Snack = { code: string; name: string; price: number; hpGain: number; fatigueGain: number; place: 'LOBBY' | 'VENDING' }
export type RankRule = { code: string; name: string; minWork: number; pay: number; vitalsMax: number; unlimited: boolean }
export type GameRules = { actions: ActionCost[]; snacks: Snack[]; ranks: RankRule[] }

export const DEFAULT_RULES: GameRules = {
  actions: [
    { code: 'IDEA_POST', name: '아이디어 글 올리기', hpCost: 3, fatigueCost: 5, description: '내 자리 컴퓨터 아이디어 기획 게시판' },
    { code: 'QA_REGISTER', name: 'QA 티켓 등록', hpCost: 3, fatigueCost: 5, description: '내 자리 컴퓨터 QA 게시판' },
    { code: 'QA_MOVE', name: 'QA 단계 변경', hpCost: 3, fatigueCost: 5, description: 'QA 티켓을 조치 중·조치 완료로' },
    { code: 'ARCADE_PLAY', name: '오락실 한 판', hpCost: 3, fatigueCost: 5, description: '오락실 메인 오락기(벽돌 부수기 등)' },
  ],
  snacks: [
    { code: 'CAKE', name: '케이크', price: 3, hpGain: 10, fatigueGain: 0, place: 'LOBBY' },
    { code: 'COFFEE', name: '커피', price: 2, hpGain: 0, fatigueGain: 5, place: 'LOBBY' },
    { code: 'COLA', name: '콜라', price: 2, hpGain: 0, fatigueGain: 5, place: 'VENDING' },
    { code: 'CIDER', name: '사이다', price: 2, hpGain: 0, fatigueGain: 5, place: 'VENDING' },
    { code: 'FANTA', name: '환타', price: 2, hpGain: 0, fatigueGain: 5, place: 'VENDING' },
    { code: 'WATER', name: '물', price: 1, hpGain: 0, fatigueGain: 2, place: 'VENDING' },
  ],
  ranks: [
    { code: 'INTERN', name: '인턴', minWork: 0, pay: 1, vitalsMax: 50, unlimited: false },
    { code: 'JUNIOR', name: '주임', minWork: 1, pay: 5, vitalsMax: 100, unlimited: false },
    { code: 'SENIOR', name: '선임', minWork: 5, pay: 10, vitalsMax: 150, unlimited: false },
    { code: 'PRINCIPAL', name: '책임', minWork: 10, pay: 20, vitalsMax: 220, unlimited: false },
    { code: 'CHIEF', name: '수석', minWork: 30, pay: 50, vitalsMax: 500, unlimited: false },
    { code: 'DIRECTOR', name: '연구소장', minWork: 100, pay: 100, vitalsMax: 999, unlimited: true },
  ],
}

let state: GameRules = DEFAULT_RULES
let loading: Promise<GameRules> | null = null
const listeners = new Set<() => void>()

export const rulesStore = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  /** 서버에서 받는다(한 번만, 실패하면 기본값 유지). */
  load(): Promise<GameRules> {
    loading ??= fetch('/api/rules', { headers: { Accept: 'application/json' } })
      .then(response => response.ok ? response.json() as Promise<GameRules> : Promise.reject(new Error(String(response.status))))
      .then(rules => {
        if (Array.isArray(rules.actions) && Array.isArray(rules.snacks) && Array.isArray(rules.ranks)) { state = rules; listeners.forEach(listener => listener()) }
        return state
      })
      .catch(() => { loading = null; return state })
    return loading
  },
  /** 테스트용 */
  reset(rules: GameRules = DEFAULT_RULES) { state = rules; loading = null },
}

export function useRules() { return useSyncExternalStore(rulesStore.subscribe, rulesStore.get, rulesStore.get) }

/**
 * 행동 비용(없으면 0).
 *
 * @param code 행동 코드
 * @param rules 규칙
 * @returns 비용
 */
export const actionCost = (code: string, rules: GameRules = state): ActionCost =>
  rules.actions.find(action => action.code === code) ?? { code, name: code, hpCost: 0, fatigueCost: 0, description: '' }

/**
 * 비용 문구: "HP -3, 기력 -5" / "HP·기력이 들지 않음".
 *
 * @param code 행동 코드
 * @param rules 규칙
 * @returns 문구
 */
export function costText(code: string, rules: GameRules = state): string {
  const cost = actionCost(code, rules)
  const parts = [cost.hpCost ? `HP -${cost.hpCost}` : '', cost.fatigueCost ? `기력 -${cost.fatigueCost}` : ''].filter(Boolean)
  return parts.length ? parts.join(', ') : 'HP·기력이 들지 않음'
}

/**
 * 간식 회복 문구: "기력 +5", "HP +10".
 *
 * @param snack 간식
 * @returns 문구
 */
export const gainText = (snack: Snack) => [snack.hpGain ? `HP +${snack.hpGain}` : '', snack.fatigueGain ? `기력 +${snack.fatigueGain}` : ''].filter(Boolean).join(' · ')

/**
 * 간식 하나(없으면 undefined).
 *
 * @param code 간식 코드
 * @param rules 규칙
 * @returns 간식
 */
export const snackOf = (code: string, rules: GameRules = state) => rules.snacks.find(snack => snack.code === code)

/**
 * 기력·HP가 모자라 막혔을 때 안내(지금 규칙의 숫자로).
 *
 * @param code 막힌 행동 코드
 * @param rules 규칙
 * @returns 안내 문구
 */
export function tiredMessage(code: string, rules: GameRules = state): string {
  const cake = snackOf('CAKE', rules), coffee = snackOf('COFFEE', rules)
  const fill = [coffee ? `${coffee.name}(${gainText(coffee)})` : '', cake ? `${cake.name}(${gainText(cake)})` : ''].filter(Boolean).join('나 ')
  return `기력이나 HP가 모자라요(한 번에 ${costText(code, rules).replace(/-/g, '')} 필요). 로비 데스크에서 ${fill || '간식'}로 채워요.`
}
