export const AGENTS = [
  { id: 'SEARCH', name: '서치', role: '정형 공고 접수·중복 확인', hours: [9], kind: 'man', x: 200 },
  { id: 'CHECK', name: '체크', role: '공고 정제·검토 상태 관리', hours: [13], kind: 'woman', x: 400 },
  { id: 'REGISTER', name: '로그', role: '지원·보류 기록과 마감 정리', hours: [15, 17], kind: 'professor', x: 600 },
] as const
export const STATE: Record<string, string> = { IDLE: '대기', WAITING: '선행 업무 대기', WORKING: '작업 중', COMPLETED: '완료', FAILED: '실패', UNAVAILABLE: '연동 대기', UNKNOWN: '조회 실패' }
export type Job = { task: string; state: string; processed: number; work_date?: string; started_at?: string; finished_at?: string; error?: string; attempts?: number }
export type Fact = { value: string | number | boolean | null; url: string; quote: string; checkedAt: string }
export type Posting = { id: string; details: { company: string; title: string; url: string; summary?: string; content?: string; stack?: string; career?: string; region?: string; snippet?: string; companyClues?: { url: string; text: string; checkedAt: string }[]; facts?: Record<string, Fact> }; validation: string; reasons: string[]; status: string | null }
export type Review = { id: string; collection_id: string | null; company: string; title: string; snapshot: Posting['details']; state: string; updated_at: string; events: { from: string; to: string; at: string }[] }
export const REVIEW_STATE: Record<string, string> = { NEW: '새 공고', READ: '읽음', CONFIRMED: '확인 완료', APPLIED: '지원 내역', HOLD: '보류 내역' }
export type Dashboard = { reviews: Review[]; stats: Record<string, number>; jobs: Job[]; postings: Posting[]; reports: { work_date: string; summary: Record<string, number> }[] }
/** 서버가 제공한 외부 링크도 허용된 HTTPS 출처인지 확인한다. */
export function safeLink(url: string) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && ['saramin.co.kr', 'jobkorea.co.kr', 'jobplanet.co.kr'].some(h => u.hostname === h || u.hostname.endsWith(`.${h}`)) } catch { return false }
}
/** 서울 날짜의 다음 업무 시각. 브라우저와 운영체제의 시간대에 의존하지 않는다. */
export function nextRun(hours: readonly number[], now = new Date()) {
  const day = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10)
  const today = hours.map(hour => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+09:00`))
  return today.find(time => time > now) ?? new Date(today[0]!.getTime() + 86400000)
}
/** 관리자 인증은 서버가 검사한다. 요청 취소와 긴 검색 작업 제한도 함께 적용한다. */
export async function request<T>(path = '', method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/recruitment${path}`, { method, credentials: 'same-origin', signal: signal ?? AbortSignal.timeout(360000), headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: unknown } | null
    if (typeof problem?.detail === 'string' && problem.detail.length <= 300) throw new Error(problem.detail)
    throw new Error(response.status === 403 || response.status === 401 ? '관리자 로그인 후 확인할 수 있어요.' : response.status === 503 ? '채용 모듈이 아직 활성화되지 않았어요.' : response.status === 409 ? '이미 처리했거나 선행 작업이 끝나지 않았어요.' : '요청을 처리하지 못했어요.')
  }
  return response.json() as Promise<T>
}
