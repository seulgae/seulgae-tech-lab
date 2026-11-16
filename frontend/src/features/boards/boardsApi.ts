/**
 * 회의 안건과 연구 아이디어 일지 API. 로그인이 없으므로 작성 때 받은 수정 키를 이 브라우저(localStorage)에만 보관하고,
 * 수정·삭제 요청에 X-Edit-Token 헤더로 보낸다. 키를 잃으면(다른 브라우저, 저장소 삭제) 그 글은 바꿀 수 없다.
 */
export type Agenda = { id: string; title: string; content: string; createdAt: string; updatedAt: string | null }
export type AgendaPage = { items: Agenda[]; hasMore: boolean }
export type IdeaRecord = { id: string; title: string; summary: string; content: string; createdAt: string }

export const AGENDA_TITLE_MAX = 8
export const AGENDA_CONTENT_MAX = 130
export const IDEA_TITLE_MAX = 40
export const IDEA_CONTENT_MAX = 130
/** 회의실 칠판이 안건이 바뀐 것을 바로 알 수 있도록 보내는 브라우저 이벤트 */
export const AGENDAS_CHANGED = 'lab:agendas-changed'

const TOKENS_KEY = 'lab.editTokens'
type TokenStore = Pick<Storage, 'getItem' | 'setItem'>
const storage = (): TokenStore | undefined => { try { return globalThis.localStorage } catch { return undefined } }

function readTokens(store = storage()): Record<string, string> {
  try { const value = JSON.parse(store?.getItem(TOKENS_KEY) ?? '{}'); return value && typeof value === 'object' ? value : {} } catch { return {} }
}
export function editToken(id: string, store = storage()) { return readTokens(store)[id] }
export function rememberToken(id: string, token: string | null, store = storage()) {
  const tokens = readTokens(store)
  if (token) tokens[id] = token; else delete tokens[id]
  try { store?.setItem(TOKENS_KEY, JSON.stringify(tokens)) } catch { /* 저장 불가 브라우저는 이번 세션 동안만 수정할 수 없다 */ }
}

/** 글자 수는 서버처럼 유니코드 코드 포인트(이모지 1자)로 센다. */
export const countChars = (value: string) => Array.from(value.replace(/\r\n?/g, '\n').trim()).length

export class BoardError extends Error {
  readonly status: number
  constructor(status: number) {
    super(status === 429 ? '잠시 후 다시 시도해 주세요. (작성 횟수 제한)' : status === 403 ? '이 브라우저에서 쓴 글만 고칠 수 있어요.'
      : status === 400 ? '제목과 내용의 글자 수를 확인해 주세요.' : status === 404 ? '이미 삭제된 글이에요.' : '잠시 후 다시 시도해 주세요.')
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init
  const response = await fetch(path, { ...rest, headers: { Accept: 'application/json', ...(rest.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-Edit-Token': token } : {}) } })
  if (!response.ok) throw new BoardError(response.status)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const fetchAgendas = (signal?: AbortSignal, limit = 20, offset = 0) => request<AgendaPage>(`/api/meeting-agendas?limit=${limit}&offset=${offset}`, { signal })

export async function createAgenda(title: string, content: string) {
  const created = await request<{ agenda: Agenda; editToken: string }>('/api/meeting-agendas', { method: 'POST', body: JSON.stringify({ title, content }) })
  rememberToken(created.agenda.id, created.editToken)
  return created.agenda
}
export const updateAgenda = (id: string, title: string, content: string) =>
  request<Agenda>(`/api/meeting-agendas/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ title, content }), token: editToken(id) })
export async function deleteAgenda(id: string) {
  await request<void>(`/api/meeting-agendas/${encodeURIComponent(id)}`, { method: 'DELETE', token: editToken(id) })
  rememberToken(id, null)
}

export const nextIdeaNumber = (signal?: AbortSignal) => request<{ number: number }>('/api/research-records/ideas/next-number', { signal }).then(value => value.number)
export const ideaTitle = (number: number) => `연구 아이디어 일지 #${number}`
export async function createIdea(title: string, content: string) {
  const created = await request<{ record: IdeaRecord; editToken: string }>('/api/research-records/ideas', { method: 'POST', body: JSON.stringify({ title, content }) })
  rememberToken(created.record.id, created.editToken)
  return created.record
}
export const updateIdea = (id: string, title: string, content: string) =>
  request<IdeaRecord>(`/api/research-records/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ title, content }), token: editToken(id) })
export async function deleteIdea(id: string) {
  await request<void>(`/api/research-records/${encodeURIComponent(id)}`, { method: 'DELETE', token: editToken(id) })
  rememberToken(id, null)
}
