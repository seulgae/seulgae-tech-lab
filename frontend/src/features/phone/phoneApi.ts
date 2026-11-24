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

/* ---------- 은행 적금 ---------- */
export type Savings = { id: string; principal: number; termDays: number; ratePct: number; createdAt: string; maturesAt: string; closedAt: string | null; payout: number | null }
export type SavingsView = { coins: number; terms: { days: number; ratePct: number }[]; savings: Savings[]; maxAmount: number; maxOpen: number }

export const fetchSavings = () => request<SavingsView>('/api/savings')
export const depositSavings = (amount: number, days: number) => request<SavingsView>('/api/savings/deposit', post({ amount, days }), {
  400: '금액과 기간을 다시 확인해 주세요.', 409: '잔액이 모자라거나 적금이 이미 3개예요.',
})
export const withdrawSavings = (id: string) => request<SavingsView>('/api/savings/withdraw', post({ id }), { 404: '내 적금이 아니에요.', 409: '이미 찾은 적금이에요.' })

/**
 * 지금 찾으면 받을 동전(서버 SavingsServiceImpl.payout과 같은 계산).
 *
 * @param item 적금
 * @param now 지금
 * @returns 받을 동전
 */
export function savingsPayout(item: Savings, now: Date): number {
  return now >= new Date(item.maturesAt) ? item.principal + Math.floor(item.principal * item.ratePct / 100) : item.principal
}

/* ---------- 주식 ---------- */
export type StockQuote = { code: string; name: string; summary: string; price: number; changePct: number; history: number[] }
export type StockHolding = { code: string; quantity: number; totalCost: number }
export type StockView = { coins: number; stocks: StockQuote[]; holdings: StockHolding[]; tradesLeftToday: number; nextTickSeconds: number }
export const STOCK_MAX_QUANTITY = 100

export const fetchStocks = () => request<StockView>('/api/stocks')
const stockMessages: Messages = { 400: `한 번에 1~${STOCK_MAX_QUANTITY}주까지 사고팔 수 있어요.`, 404: '없는 종목이에요.', 409: '잔액이나 가진 주식이 모자라요.', 429: '오늘은 더 거래할 수 없어요(하루 30번).' }
export const buyStock = (code: string, quantity: number) => request<StockView>('/api/stocks/buy', post({ code, quantity }), stockMessages)
export const sellStock = (code: string, quantity: number) => request<StockView>('/api/stocks/sell', post({ code, quantity }), stockMessages)

/**
 * 보유 주식의 평가 손익: 지금 가격으로 팔면 받을 돈 - 산 금액.
 *
 * @param holding 보유
 * @param price 현재가
 * @returns 손익(동전)
 */
export const profitOf = (holding: StockHolding, price: number) => holding.quantity * price - holding.totalCost
