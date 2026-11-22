/**
 * 폰 앱 API: 은행(잔액·거래 내역·송금), 캘린더 할 일, SNS. 서버가 원본이고 규칙도 서버가 확인한다.
 */
export type CoinEvent = { id: string; amount: number; reason: string; reasonName: string; counterpart: string | null; createdAt: string }
export type BankView = { coins: number; transfersLeftToday: number; history: CoinEvent[] }
export type Recipient = { id: string; nickname: string }
export type Todo = { id: string; date: string; title: string; done: boolean; createdAt: string }
export type SnsPost = { id: string; nickname: string; content: string; createdAt: string; mine: boolean }

export const TRANSFER_MAX = 100
export const TODO_TITLE_MAX = 40
export const SNS_CONTENT_MAX = 140

/** 상태 코드별 안내(앱마다 409·429 뜻이 달라 따로 받는다) */
type Messages = Partial<Record<number, string>>

async function request<T>(path: string, init: RequestInit = {}, messages: Messages = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) {
    throw new Error(messages[response.status] ?? (response.status === 401 ? '로그인한 연구원만 쓸 수 있어요.'
      : response.status === 429 ? '잠시 후 다시 시도해 주세요.' : response.status === 400 ? '입력한 내용을 다시 확인해 주세요.' : '요청에 실패했어요.'))
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const fetchBank = () => request<BankView>('/api/bank')
export const searchRecipients = (query: string) => request<Recipient[]>(`/api/bank/members?q=${encodeURIComponent(query.trim())}`)
export const transfer = (to: string, amount: number) => request<BankView>('/api/bank/transfer', post({ to, amount }), {
  400: `1~${TRANSFER_MAX}원까지 다른 연구원에게만 보낼 수 있어요.`, 404: '받는 연구원을 찾지 못했어요.',
  409: '잔액이 모자라요.', 429: '오늘은 더 보낼 수 없어요(하루 10번).',
})

export const fetchTodos = (month: string) => request<Todo[]>(`/api/todos?month=${encodeURIComponent(month)}`)
export const addTodo = (date: string, title: string) => request<Todo>('/api/todos', post({ date, title: title.trim() }), {
  400: `할 일은 ${TODO_TITLE_MAX}자까지, 날짜는 오늘에서 1년 안이에요.`, 409: '할 일이 너무 많아요. 지난 일을 지워 주세요.',
})
export const setTodoDone = (id: string, done: boolean) => request<Todo>(`/api/todos/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ done }) })
export const deleteTodo = (id: string) => request<void>(`/api/todos/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const fetchSns = () => request<SnsPost[]>('/api/sns')
export const writeSns = (content: string) => request<SnsPost>('/api/sns', post({ content: content.trim() }), {
  400: `글은 1~${SNS_CONTENT_MAX}자예요.`, 429: '오늘은 글을 충분히 썼어요(하루 20개).',
})
export const deleteSns = (id: string) => request<void>(`/api/sns/${encodeURIComponent(id)}`, { method: 'DELETE' }, { 403: '내 글만 지울 수 있어요.' })

/** 거래 내역 금액 표시: +10원 / -3원 */
export const amountText = (amount: number) => `${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')}원`
