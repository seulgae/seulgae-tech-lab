import type { ResearchPage, ResearchRecord } from '../model/researchTypes'

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('연구 기록을 불러오지 못했다.')
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) throw new Error('연구 기록 응답 형식이 올바르지 않다.')
  return response.json() as Promise<T>
}

export function fetchResearchPage(signal: AbortSignal, offset = 0) {
  return getJson<ResearchPage>(`/api/research-records?limit=10&offset=${offset}`, signal)
}

export function fetchResearchRecord(id: string, signal: AbortSignal) {
  return getJson<ResearchRecord>(`/api/research-records/${encodeURIComponent(id)}`, signal)
}
