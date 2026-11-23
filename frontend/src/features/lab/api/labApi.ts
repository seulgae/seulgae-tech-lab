import { parseBuildInfo, parseLabStatus } from '../model/labTypes.ts'
import { parseCapacity } from '../model/capacity.ts'

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error('연구소 정보를 불러오지 못했다.')
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('연구소 응답 형식이 올바르지 않다.')
  return response.json()
}

export async function fetchLabStatus(signal: AbortSignal) { return parseLabStatus(await getJson('/api/lab/status', signal)) }
export async function fetchBuildInfo(signal: AbortSignal) { return parseBuildInfo(await getJson('/api/lab/build', signal)) }
export async function fetchCapacity(signal: AbortSignal) { return parseCapacity(await getJson('/api/lab/capacity', signal)) }
