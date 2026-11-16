import { useSyncExternalStore } from 'react'
import { editToken } from '../boards/boardsApi.ts'

/**
 * 카카오 로그인 상태(헤더·패널·게임이 공유). 서버 /api/auth/me를 한 번 읽고, 로그인 회원이면 내가 쓴 글 ID도 읽는다.
 * 로그인이 꺼져 있으면(kakaoEnabled=false) 글쓰기는 기존처럼 누구나 할 수 있다.
 */
export type Member = { id: string; nickname: string }
export type AuthState = {
  loaded: boolean
  kakaoEnabled: boolean
  member: Member | null
  ownedRecords: Set<string>
  ownedAgendas: Set<string>
}
export const NICKNAME_PATTERN = /^[\p{L}\p{N}_-]{1,16}$/u
export const LOGIN_URL = '/api/auth/kakao/login'

let state: AuthState = { loaded: false, kakaoEnabled: false, member: null, ownedRecords: new Set(), ownedAgendas: new Set() }
const listeners = new Set<() => void>()
const set = (patch: Partial<AuthState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }

export const authStore = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  /** 처음 한 번 로그인 상태를 읽는다. 실패하면 비로그인으로 둔다(사이트는 그대로 동작). */
  async load(fetcher: typeof fetch = fetch) {
    try {
      const response = await fetcher('/api/auth/me', { headers: { Accept: 'application/json' } })
      const me = response.ok ? await response.json() as { kakaoEnabled?: unknown; member?: Member | null } : null
      const member = me?.member && typeof me.member.id === 'string' && typeof me.member.nickname === 'string' ? me.member : null
      set({ loaded: true, kakaoEnabled: me?.kakaoEnabled === true, member })
      if (member) await authStore.refreshOwned(fetcher)
    } catch { set({ loaded: true }) }
  },
  /** 글을 쓰거나 지운 뒤 "내 글" 표시를 갱신한다. */
  async refreshOwned(fetcher: typeof fetch = fetch) {
    if (!state.member) return
    try {
      const response = await fetcher('/api/auth/me/owned', { headers: { Accept: 'application/json' } })
      if (!response.ok) return
      const owned = await response.json() as { recordIds?: string[]; agendaIds?: string[] }
      set({ ownedRecords: new Set(owned.recordIds ?? []), ownedAgendas: new Set(owned.agendaIds ?? []) })
    } catch { /* 표시만 늦어진다 */ }
  },
  async logout(fetcher: typeof fetch = fetch) {
    await fetcher('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    set({ member: null, ownedRecords: new Set(), ownedAgendas: new Set() })
  },
  async rename(nickname: string, fetcher: typeof fetch = fetch) {
    const response = await fetcher('/api/auth/me/nickname', { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ nickname }) })
    if (!response.ok) throw new Error(response.status === 429 ? '잠시 후 다시 시도해 주세요.' : '닉네임은 1~16자의 글자·숫자·_·-만 쓸 수 있어요.')
    const member = await response.json() as Member
    set({ member })
    return member
  },
  /** 테스트용 상태 초기화 */
  reset(patch: Partial<AuthState> = {}) { state = { loaded: false, kakaoEnabled: false, member: null, ownedRecords: new Set(), ownedAgendas: new Set(), ...patch } },
}

/** 로그인이 꺼져 있거나, 로그인한 회원이면 쓸 수 있다. */
export const canWrite = (auth: AuthState) => !auth.kakaoEnabled || !!auth.member
/** 이 브라우저의 수정 키가 있거나, 로그인 회원이 쓴 글이면 내 글이다. */
export const isMine = (auth: AuthState, kind: 'record' | 'agenda', id: string) =>
  !!editToken(id) || (kind === 'record' ? auth.ownedRecords : auth.ownedAgendas).has(id)

export function useAuth() { return useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get) }
