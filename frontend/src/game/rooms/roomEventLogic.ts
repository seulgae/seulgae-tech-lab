/**
 * 방별 이벤트의 시간·상태 규칙이다. Phaser에 의존하지 않아 node 테스트로 검증한다.
 * 이벤트는 각 브라우저에서만 재생되는 연출이며 서버·다른 참가자와 동기화하지 않는다.
 */
export type Random = () => number

/** min~max(ms) 사이의 다음 이벤트 대기 시간 */
export function nextDelay(min: number, max: number, random: Random = Math.random) {
  return Math.round(min + (max - min) * Math.min(Math.max(random(), 0), 1))
}

export const LOBBY_ANNOUNCEMENTS = [
  '개발 연구실에서 새 빌드가 돌아가고 있어요.',
  '회의실 테이블에서 E를 누르면 테이블 대화를 할 수 있어요.',
  '서버실 랙 상태를 수시로 확인해 주세요.',
  '오른쪽 키오스크에서 최근 연구 기록을 볼 수 있어요.',
  '잠시 소파에서 쉬어 가도 괜찮아요.',
] as const

export const BOARD_MESSAGES = ['SEULGAE TECH LAB', 'WELCOME, RESEARCHER', 'BUILD·LEARN·DISCOVER'] as const

/** 화이트보드 필기 영역(약 100×50)에 들어가도록 짧게 쓴다. */
export const MEETING_AGENDA = [
  '오늘의 안건\n· 분위기 리뉴얼',
  '오늘의 안건\n· 테이블 대화',
  '오늘의 안건\n· 다음 실험',
  '오늘의 안건\n· 경보 회고',
] as const

/** 순서를 돌며 메시지를 고른다. 음수·범위를 넘는 번호도 안전하게 순환한다. */
export function rotate<T>(list: readonly T[], index: number) {
  return list[((index % list.length) + list.length) % list.length]!
}

/** 직전 스냅샷에 없던 다른 참가자를 새로 도착한 사람으로 본다. 첫 스냅샷은 기존 인원으로 처리한다. */
export function detectArrivals<T extends { id: string }>(previous: Set<string> | null, players: T[], selfId: string | null): T[] {
  if (!previous) return []
  return players.filter(player => player.id !== selfId && !previous.has(player.id))
}

export type BuildRun = { number: number; passed: boolean; failedTests: number; durationMs: number }

/** 벽 스크린 CI 빌드 연출. 대부분 성공하고 가끔 실패한다. */
export class CiPipeline {
  private number: number
  constructor(start = 128) { this.number = start }
  next(random: Random = Math.random): BuildRun {
    this.number++
    const passed = random() >= 0.22
    return { number: this.number, passed, failedTests: passed ? 0 : 1 + Math.floor(random() * 3), durationMs: 4200 }
  }
}

export type AlertState = { active: false } | { active: true; rack: string; startedAt: number }
export type AlertResult = 'manual' | 'auto'
export const ALERT_AUTO_RESOLVE_MS = 12000

/** 서버실 과열 경보. 랙에서 E로 수동 냉각하거나 일정 시간이 지나면 자동 냉각된다. */
export class ServerAlert {
  state: AlertState = { active: false }

  trigger(now: number, rack: string) {
    if (this.state.active) return false
    this.state = { active: true, rack, startedAt: now }
    return true
  }

  /** 수동 냉각. 경보 중일 때만 성공한다. */
  resolve(): AlertResult | null {
    if (!this.state.active) return null
    this.state = { active: false }
    return 'manual'
  }

  /** 자동 냉각 시간이 지났으면 해제하고 'auto'를 돌려준다. */
  update(now: number): AlertResult | null {
    if (!this.state.active || now - this.state.startedAt < ALERT_AUTO_RESOLVE_MS) return null
    this.state = { active: false }
    return 'auto'
  }
}

export const RACK_LABELS = ['R-01', 'R-02', 'R-03', 'R-04'] as const

export type TreatKind = 'coffee' | 'cake'
/** 이 브라우저에서 오늘 먹고 마신 횟수. 날짜가 바뀌면 처음부터 센다. */
export type TreatLog = { date: string; coffee: number; cake: number }
export const TREAT_STORAGE_KEY = 'seulgae.lobby.treats'
const TREAT_LIMIT = 99

/** 로컬 날짜를 YYYY-MM-DD로 만든다(자정에 하루가 바뀌도록 UTC가 아닌 브라우저 시간대 기준). */
export function localDay(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 저장된 기록(JSON 문자열)을 읽어 kind를 하나 늘린 새 기록을 돌려준다. 깨진 값·지난 날짜는 0부터 센다. */
export function countTreat(saved: string | null, kind: TreatKind, today: string): TreatLog {
  const log: TreatLog = { date: today, coffee: 0, cake: 0 }
  try {
    const parsed = JSON.parse(saved ?? 'null') as Partial<TreatLog> | null
    if (parsed?.date === today) for (const key of ['coffee', 'cake'] as const) {
      const value = parsed[key]
      if (Number.isSafeInteger(value) && (value as number) >= 0) log[key] = Math.min(value as number, TREAT_LIMIT)
    }
  } catch { /* 깨진 기록은 버린다 */ }
  log[kind] = Math.min(log[kind] + 1, TREAT_LIMIT)
  return log
}

/** 먹고 마신 뒤 배너 문구. 커피를 많이 마시면 쉬어 가라고 한다. */
export function treatMessage(kind: TreatKind, count: number) {
  if (kind === 'coffee') {
    if (count === 1) return '오늘 첫 커피! 집중력이 올라가요'
    return count >= 4 ? `오늘 커피 ${count}잔째 · 물도 한 잔 마셔요` : `오늘 커피 ${count}잔째`
  }
  return count === 1 ? '달콤한 케이크로 당 충전 완료!' : `오늘 케이크 ${count}조각째`
}
