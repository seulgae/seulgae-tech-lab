/**
 * 개발 연구실 슈퍼컴퓨터의 GitHub PR 목록(/api/lab/pulls). 서버가 GitHub 공개 API를 5분 캐시해 돌려준다.
 */
export type Pull = { number: number; title: string; author: string | null; draft: boolean; createdAt: string | null; mergedAt: string | null; url: string }
export type Pulls = { repo: string; open: Pull[]; merged: Pull[]; fetchedAt: string | null; stale: boolean }

/** 개발 연구실 슈퍼컴퓨터 패널을 열고 닫는 장면↔화면 이벤트 */
export const PULLS_EVENTS = { openPulls: 'pulls:open', closePulls: 'pulls:close' } as const

const pull = (p: Pull) => p && Number.isInteger(p.number) && p.number > 0 && typeof p.title === 'string' && typeof p.draft === 'boolean'
  && typeof p.url === 'string' && p.url.startsWith('https://github.com/')

/** 응답 검사: 링크는 github.com만 남긴다(화면이 새 창으로 여는 주소라서). */
export function parsePulls(value: unknown): Pulls {
  const v = value as Pulls
  if (!v || typeof v !== 'object' || typeof v.repo !== 'string' || !Array.isArray(v.open) || !Array.isArray(v.merged) || typeof v.stale !== 'boolean')
    throw new Error('Invalid pulls')
  return { ...v, open: v.open.filter(pull), merged: v.merged.filter(pull) }
}

export async function fetchPulls(signal?: AbortSignal) {
  const response = await fetch('/api/lab/pulls', { signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error('PR 목록을 불러오지 못했어요.')
  return parsePulls(await response.json())
}

/** "3시간 전", "2일 전" */
export function ago(iso: string | null, now = Date.now()) {
  if (!iso) return ''
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / 1440)}일 전`
}
