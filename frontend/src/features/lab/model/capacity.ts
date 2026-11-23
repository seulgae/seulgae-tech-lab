/**
 * 서버실 랙 4개의 용량 조사(/api/lab/capacity). 랙마다 보여 줄 분류와 응답 검사, 숫자 표기를 둔다.
 */
export type Point = { at: string; value: number }
export type Capacity = {
  probe: { state: string; collectedAt: string | null }
  cpu: { usedPercent: number; user: number; system: number; ioWait: number; load1: number; load5: number; load15: number; cores: number; loadPerCore: number; jvmProcessPercent: number; warning: boolean; history: Point[] }
  memory: { usedPercent: number; totalMb: number; usedMb: number; availableMb: number; buffCacheMb: number; swapTotalMb: number; swapUsedMb: number; warning: boolean; history: Point[] } | null
  heap: { usedMb: number; committedMb: number; maxMb: number; usedPercent: number; nonHeapMb: number; gcCount: number; gcMillis: number; threads: number; peakThreads: number; warning: boolean }
  uptime: { hostSeconds: number | null; hostBootAt: string | null; jvmSeconds: number; jvmStartAt: string }
  serverTime: string
}

/** 서버실 랙(상호작용 id)과 보여 줄 분류. 왼쪽부터 1·2·3·4번 */
export const RACKS = {
  'server-rack-1': { no: 1, topic: 'cpu', title: 'CPU 실시간 사용량' },
  'server-rack-2': { no: 2, topic: 'memory', title: '메모리 사용량' },
  'server-rack-3': { no: 3, topic: 'heap', title: 'JVM 힙' },
  'server-rack-4': { no: 4, topic: 'uptime', title: '가동시간' },
} as const
export type RackId = keyof typeof RACKS
export const isRackId = (id: string): id is RackId => id in RACKS

/** 수집 상태 안내(호스트 값이 필요한 랙에서 보여 준다) */
export const PROBE_STATES: Record<string, string> = {
  OK: '정상 수집 중', PENDING: '첫 수집을 기다리는 중', NOT_CONFIGURED: '호스트 수집(SSH)이 아직 설정되지 않았어요',
  CONNECT: '호스트에 접속하지 못했어요', TIMEOUT: '호스트 응답이 늦어요', EXIT: '수집 명령이 실패했어요', PARSE: '수집 결과를 읽지 못했어요', OUTPUT: '수집 결과가 너무 커요',
}

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const nonNegative = (value: unknown) => finite(value) && (value as number) >= 0
const points = (value: unknown) => Array.isArray(value) && value.length <= 60 && value.every(p => p && typeof p.at === 'string' && finite(p.value))

/** 응답 모양을 검사한다. 이상하면 예외 */
export function parseCapacity(value: unknown): Capacity {
  const c = value as Capacity
  const ok = c && typeof c === 'object' && c.probe && typeof c.probe.state === 'string'
    && c.cpu && ['usedPercent', 'user', 'system', 'ioWait', 'load1', 'load5', 'load15', 'cores', 'loadPerCore', 'jvmProcessPercent'].every(k => nonNegative((c.cpu as Record<string, unknown>)[k])) && points(c.cpu.history)
    && (c.memory === null || (c.memory && ['usedPercent', 'totalMb', 'usedMb', 'availableMb', 'buffCacheMb', 'swapTotalMb', 'swapUsedMb'].every(k => nonNegative((c.memory as Record<string, unknown>)[k])) && points(c.memory.history)))
    && c.heap && ['usedMb', 'committedMb', 'maxMb', 'usedPercent', 'nonHeapMb', 'gcCount', 'gcMillis', 'threads', 'peakThreads'].every(k => nonNegative((c.heap as Record<string, unknown>)[k]))
    && c.uptime && nonNegative(c.uptime.jvmSeconds) && (c.uptime.hostSeconds === null || nonNegative(c.uptime.hostSeconds))
    && typeof c.serverTime === 'string'
  if (!ok) throw new Error('Invalid capacity')
  return c
}

/** 1536 → "1.5 GiB", 512 → "512 MiB" */
export const formatMb = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GiB` : `${Math.round(mb)} MiB`

/** 퍼센트 기록을 0~100 높이의 막대 SVG 경로용 좌표로(가로 width, 세로 height) */
export function sparkline(history: Point[], width = 240, height = 40) {
  if (history.length < 2) return ''
  const step = width / (history.length - 1)
  return history.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - Math.min(100, Math.max(0, p.value)) / 100 * height).toFixed(1)}`).join(' ')
}
