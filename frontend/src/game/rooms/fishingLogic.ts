import type { SkyPhase } from './timeOfDay.ts'

/**
 * 강가 낚시 미니게임 규칙. Phaser에 의존하지 않아 node 테스트로 검증한다.
 * 흐름: 던지기 → 기다리기(찌가 둥둥) → 입질(짧은 시간 안에 E) → 게이지(바늘이 초록 칸에 있을 때 E) → 결과
 * 결과는 이 브라우저에만(localStorage) 남는 클라이언트 전용 기록이다.
 */
export type Random = () => number
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export type FishSpecies = { id: string; name: string; rarity: Rarity; minCm: number; maxCm: number; weight: number; phases?: SkyPhase[] }
export type Catch = { species: FishSpecies; cm: number }

export const FISH: readonly FishSpecies[] = [
  { id: 'minnow', name: '피라미', rarity: 'common', minCm: 8, maxCm: 15, weight: 34 },
  { id: 'crucian', name: '붕어', rarity: 'common', minCm: 15, maxCm: 32, weight: 30 },
  { id: 'mandarin', name: '쏘가리', rarity: 'uncommon', minCm: 20, maxCm: 42, weight: 14, phases: ['morning', 'noon', 'sunset'] },
  { id: 'catfish', name: '메기', rarity: 'uncommon', minCm: 30, maxCm: 65, weight: 16, phases: ['evening', 'dawn'] },
  { id: 'trout', name: '무지개송어', rarity: 'rare', minCm: 28, maxCm: 55, weight: 6, phases: ['early-morning', 'morning'] },
  { id: 'golden-carp', name: '황금 잉어', rarity: 'legendary', minCm: 45, maxCm: 90, weight: 1.5 },
]

export const RARITY_LABELS: Record<Rarity, string> = { common: '흔함', uncommon: '조금 드묾', rare: '희귀', legendary: '전설' }
/** 드문 물고기일수록 게이지의 초록 칸이 좁고 바늘이 빠르다. */
const ZONE_WIDTH: Record<Rarity, number> = { common: 0.3, uncommon: 0.22, rare: 0.15, legendary: 0.1 }
const NEEDLE_SPEED: Record<Rarity, number> = { common: 0.8, uncommon: 1.05, rare: 1.35, legendary: 1.7 }

export const BITE_WINDOW_MS = 900
export const REEL_TIMEOUT_MS = 4500
export const FISH_LOG_KEY = 'seulgae.outdoor.fishlog'

const pick = (random: Random) => Math.min(Math.max(random(), 0), 0.999999)

/** 찌를 던진 뒤 입질까지 기다리는 시간(1.5~5초) */
export function waitBeforeBite(random: Random = Math.random) { return Math.round(1500 + pick(random) * 3500) }

/** 지금 시간대에 나오는 물고기 중 가중치로 하나를 고르고 크기를 정한다. */
export function rollCatch(phase: SkyPhase, random: Random = Math.random): Catch {
  const pool = FISH.filter(fish => !fish.phases || fish.phases.includes(phase))
  let ticket = pick(random) * pool.reduce((sum, fish) => sum + fish.weight, 0)
  let species = pool[0]!
  for (const fish of pool) { ticket -= fish.weight; if (ticket < 0) { species = fish; break } }
  const cm = Math.round(species.minCm + pick(random) * (species.maxCm - species.minCm))
  return { species, cm }
}

/** 게이지의 초록 칸(0~1 범위의 시작·너비). 양 끝에 붙지 않게 안쪽에 둔다. */
export function catchZone(rarity: Rarity, random: Random = Math.random) {
  const width = ZONE_WIDTH[rarity]
  return { start: 0.05 + pick(random) * (0.9 - width), width }
}

/** 바늘 위치(0~1). 0→1→0을 일정한 속도로 오가는 삼각파다. */
export function needleAt(elapsedMs: number, rarity: Rarity) {
  const phase = (Math.max(elapsedMs, 0) / 1000 * NEEDLE_SPEED[rarity]) % 2
  return phase <= 1 ? phase : 2 - phase
}

export const inZone = (needle: number, zone: { start: number; width: number }) => needle >= zone.start && needle <= zone.start + zone.width

export type FishLog = { date: string; today: number; total: number; best: Record<string, number> }

/** 기록을 읽어 잡은 물고기를 더한다. 오늘 마릿수는 날짜가 바뀌면 0부터, 종류별 최대 크기는 계속 남긴다. */
export function recordCatch(saved: string | null, caught: Catch, today: string): { log: FishLog; record: boolean } {
  const log: FishLog = { date: today, today: 0, total: 0, best: {} }
  try {
    const parsed = JSON.parse(saved ?? 'null') as Partial<FishLog> | null
    if (parsed && typeof parsed === 'object') {
      if (Number.isSafeInteger(parsed.total) && parsed.total! >= 0) log.total = Math.min(parsed.total!, 99999)
      if (parsed.date === today && Number.isSafeInteger(parsed.today) && parsed.today! >= 0) log.today = Math.min(parsed.today!, 9999)
      if (parsed.best && typeof parsed.best === 'object') for (const fish of FISH) {
        const value = (parsed.best as Record<string, unknown>)[fish.id]
        if (Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 999) log.best[fish.id] = value as number
      }
    }
  } catch { /* 깨진 기록은 버린다 */ }
  const previous = log.best[caught.species.id] ?? 0
  log.today += 1
  log.total += 1
  log.best[caught.species.id] = Math.max(previous, caught.cm)
  return { log, record: previous > 0 && caught.cm > previous }
}

export function catchMessage(caught: Catch, log: FishLog, record: boolean) {
  const base = `${caught.species.name} ${caught.cm}cm를 낚았어요! (${RARITY_LABELS[caught.species.rarity]})`
  return record ? `★ 신기록! ${base}` : `${base} · 오늘 ${log.today}마리`
}
