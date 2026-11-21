import { BoardError } from '../boards/boardsApi.ts'

/**
 * 사무실 업무 게시판 API. 1번 QA 등록 → 2번 유지보수 조치·가이드 → 4번 운영 점검·최종 승인(반려 시 2번).
 */
export type WorkBoard = 'QA' | 'MAINTENANCE' | 'OPERATION'
export type WorkStatus = 'REGISTERED' | 'IN_PROGRESS' | 'RESOLVED' | 'APPROVED' | 'REJECTED'
export type WorkItem = {
  id: string; parentId: string | null; category: WorkBoard; status: WorkStatus
  title: string; content: string; guide: string | null; createdAt: string
}
export type Code = { group: string; code: string; name: string; sortOrder: number }
export type BoardView = { board: WorkBoard; categories: Code[]; statuses: Code[]; inbox: WorkItem[]; entries: WorkItem[] }
export type Thread = { ticket: WorkItem; records: WorkItem[] }

/** 서비스 연구실의 컴퓨터(상호작용 id)마다 열리는 게시판: QA → 유지보수 → 운영 */
export const WORK_BOARDS: Partial<Record<string, WorkBoard>> = { 'service-qa': 'QA', 'service-maintenance': 'MAINTENANCE', 'service-operation': 'OPERATION' }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) throw new BoardError(response.status)
  return response.json() as Promise<T>
}

export const fetchBoard = (board: WorkBoard, signal?: AbortSignal) => request<BoardView>(`/api/work-items?board=${board}`, { signal })
export const fetchThread = (id: string, signal?: AbortSignal) => request<Thread>(`/api/work-items/${encodeURIComponent(id)}`, { signal })
export const createQa = (title: string, content: string) =>
  request<WorkItem>('/api/work-items/qa', { method: 'POST', body: JSON.stringify({ title, content }) })
export const addMaintenance = (ticketId: string, content: string, guide: string, done: boolean) =>
  request<Thread>(`/api/work-items/${encodeURIComponent(ticketId)}/maintenance`, { method: 'POST', body: JSON.stringify({ content, guide, done }) })
export const addOperation = (ticketId: string, content: string, approved: boolean) =>
  request<Thread>(`/api/work-items/${encodeURIComponent(ticketId)}/operation`, { method: 'POST', body: JSON.stringify({ content, approved }) })

/** 공통코드 이름(없으면 코드 그대로) */
export const codeName = (codes: Code[], code: string) => codes.find(item => item.code === code)?.name ?? code
