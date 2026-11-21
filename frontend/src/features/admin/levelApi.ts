/**
 * 회원 등급(1 일반 사용자, 2 운영자, 3 관리자)과 등급 신청 API.
 */
export type LevelRequest = { id: string; memberId: string; nickname: string; requestedLevel: number; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string }
export type MyLevel = { level: number; request: LevelRequest | null }
export const LEVEL_NAMES: Record<number, string> = { 0: '비회원', 1: '일반 사용자', 2: '운영자', 3: '관리자' }
export const REQUEST_STATUS_NAMES: Record<LevelRequest['status'], string> = { PENDING: '검토 중', APPROVED: '승인', REJECTED: '반려' }
export const REASON_MAX = 200

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) {
    throw new Error(response.status === 401 ? '로그인이 필요해요.' : response.status === 403 ? '관리자만 할 수 있어요.'
      : response.status === 409 ? '이미 검토 중인 신청이 있어요.' : response.status === 429 ? '잠시 후 다시 시도해 주세요.'
      : response.status === 400 ? '지금보다 높은 등급과 사유(200자 이내)를 적어 주세요.' : '요청에 실패했어요.')
  }
  return response.json() as Promise<T>
}

export const fetchMyLevel = () => request<MyLevel>('/api/level-requests/me')
export const applyLevel = (level: number, reason: string) => request<LevelRequest>('/api/level-requests', { method: 'POST', body: JSON.stringify({ level, reason: reason.trim() }) })
export const fetchPendingLevels = () => request<LevelRequest[]>('/api/admin/level-requests')
export const decideLevel = (id: string, approve: boolean) => request<LevelRequest>(`/api/admin/level-requests/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ approve }) })
