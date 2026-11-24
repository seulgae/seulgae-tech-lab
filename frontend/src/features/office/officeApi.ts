import { BoardError } from '../boards/boardsApi.ts'

/**
 * 서비스 연구실 API: 아이디어 기획 게시판, QA 게시판(등록 → 조치 중 → 조치 완료), 내 자리 컴퓨터(오늘 업무·자바 연습).
 *
 * @author 길태형
 * @version 1.0, 게시판 개편·내 자리 컴퓨터
 * @see "None"
 */
export type IdeaPost = { id: string; title: string; content: string; author: string | null; createdAt: string }
export type QaStatus = 'REGISTERED' | 'IN_PROGRESS' | 'RESOLVED'
export type QaTicket = { id: string; title: string; content: string; status: QaStatus; statusName: string; author: string | null; createdAt: string; updatedAt: string | null }
export type DailyTask = { code: string; title: string; where: string; done: boolean }
export type JavaProblem = { id: string; title: string; description: string; argsCode: string; expected: string; hints: string[] }
export type DeskView = { tasks: DailyTask[]; reward: number; rewardClaimed: boolean; problems: JavaProblem[]; javaRewardsToday: number; javaRewardLimit: number; coins: number; promotedTo?: string | null }
export type JavaAnswer = { problemId: string; format: string; output: string | null; correct: boolean; rewarded: boolean; error: string | null }

/** 서비스 연구실 컴퓨터(상호작용 id) → 열 창. 아이디어·QA 게시판은 내 자리 컴퓨터의 아이콘으로 연다. */
export const OFFICE_COMPUTERS = { 'service-my-desk': 'my-desk' } as const
/** QA 진행 순서와 다음 단계 버튼 문구 */
export const QA_FLOW: readonly QaStatus[] = ['REGISTERED', 'IN_PROGRESS', 'RESOLVED']
export const QA_NEXT: Partial<Record<QaStatus, { status: QaStatus; label: string }>> = {
  REGISTERED: { status: 'IN_PROGRESS', label: '조치 중으로' },
  IN_PROGRESS: { status: 'RESOLVED', label: '조치 완료로' },
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) throw new BoardError(response.status)
  return await response.json() as T
}
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const fetchIdeas = () => request<IdeaPost[]>('/api/ideas')
export const createIdea = (title: string, content: string) => request<IdeaPost>('/api/ideas', post({ title: title.trim(), content: content.trim() }))
export const fetchQa = () => request<QaTicket[]>('/api/qa')
export const createQa = (title: string, content: string) => request<QaTicket>('/api/qa', post({ title: title.trim(), content: content.trim() }))
export const moveQa = (id: string, status: QaStatus) => request<QaTicket>(`/api/qa/${encodeURIComponent(id)}/status`, post({ status }))
export const fetchDesk = () => request<DeskView>('/api/desk')
export const claimDailyReward = () => request<DeskView>('/api/desk/claim', { method: 'POST' })
export const answerJava = (problemId: string, format: string) => request<JavaAnswer>('/api/desk/java', post({ problemId, format }))

/**
 * 자바 문자열 리터럴로 보여 준다(따옴표·역슬래시 이스케이프).
 *
 * @param value 형식 문자열
 * @returns "..." 형태
 */
export const javaString = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
