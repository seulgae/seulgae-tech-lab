import { BoardError } from '../boards/boardsApi.ts'

/**
 * 로비 방명록 API. 제목 8자, 내용 130자(서버·DB도 같은 제한).
 */
export type GuestbookEntry = { id: string; category: string; title: string; content: string; author: string | null; createdAt: string }
export const GUESTBOOK_TITLE_MAX = 8
export const GUESTBOOK_CONTENT_MAX = 130

/** 글자 수(이모지 같은 서로게이트 쌍도 한 글자로 센다. 서버의 codePointCount와 같다) */
export const charCount = (value: string) => Array.from(value.trim()).length
/** 입력값을 최대 글자 수까지만 남긴다(앞 공백은 그대로 두어 입력 중 커서가 튀지 않게 한다). */
export const clip = (value: string, max: number) => Array.from(value).slice(0, max).join('')
/** 보낼 수 있는 글인지(앞뒤 공백 제외 1자 이상, 최대 글자 수 이하) */
export const validEntry = (title: string, content: string) =>
  charCount(title) >= 1 && charCount(title) <= GUESTBOOK_TITLE_MAX && charCount(content) >= 1 && charCount(content) <= GUESTBOOK_CONTENT_MAX

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) throw new BoardError(response.status)
  return response.json() as Promise<T>
}

export const fetchGuestbook = (signal?: AbortSignal) => request<GuestbookEntry[]>('/api/guestbook', { signal })
export const writeGuestbook = (title: string, content: string) =>
  request<GuestbookEntry>('/api/guestbook', { method: 'POST', body: JSON.stringify({ title: title.trim(), content: content.trim() }) })
