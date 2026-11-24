/**
 * 사원증·급여 API. 직급은 누적 일 완료 수(오늘 업무 보상을 받은 날 수)로 정하고, 급여는 접속해 있는 동안 10분마다 들어온다.
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see None
 */
export type Rank = { code: string; name: string; minWork: number; pay: number; vitalsMax: number; unlimited: boolean }
export type BadgeView = {
  nickname: string; rank: Rank; next: Rank | null; workCount: number; nextSalarySeconds: number
  salaryCountToday: number; salaryToday: number; paid: number; coins: number; ranks: Rank[]
}

/** 화면이 급여 차례를 확인하는 간격(지급은 서버가 10분에 한 번만 한다) */
export const SALARY_TICK_MS = 60_000
/** 직급 배지 색 */
export const RANK_COLORS: Record<string, string> = {
  INTERN: '#9ca3af', JUNIOR: '#4ade80', SENIOR: '#38bdf8', PRINCIPAL: '#a78bfa', CHIEF: '#f59e0b', DIRECTOR: '#ef4444',
}

async function request(path: string, init: RequestInit = {}): Promise<BadgeView> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(response.status === 401 ? '로그인한 연구원만 사원증이 있어요.' : '사원증을 불러오지 못했어요.')
  return await response.json() as BadgeView
}

export const fetchBadge = () => request('/api/badge')
export const tickSalary = () => request('/api/badge/tick', { method: 'POST' })

/**
 * 다음 직급까지 진행률(0~1). 최고 직급이면 1.
 *
 * @param view 사원증
 * @returns 진행률
 */
export function promotionProgress(view: Pick<BadgeView, 'rank' | 'next' | 'workCount'>): number {
  if (!view.next) return 1
  return Math.min(1, Math.max(0, (view.workCount - view.rank.minWork) / (view.next.minWork - view.rank.minWork)))
}

/**
 * 남은 초를 "8분 20초"처럼.
 *
 * @param seconds 남은 초
 * @returns 문구
 */
export const remainText = (seconds: number) => seconds <= 0 ? '곧' : `${Math.floor(seconds / 60) ? `${Math.floor(seconds / 60)}분 ` : ''}${seconds % 60}초`
