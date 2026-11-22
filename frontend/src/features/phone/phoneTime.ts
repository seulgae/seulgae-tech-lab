/**
 * 폰 시계·달력 계산(한국 시간). 화면 없이 테스트할 수 있게 순수 함수로 둔다.
 */
const pad = (value: number) => String(value).padStart(2, '0')

/** 한국 시간 기준 날짜·시각 */
export function seoulNow(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1, day: kst.getUTCDate(), hour: kst.getUTCHours(), minute: kst.getUTCMinutes() }
}

export const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`
export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`
export const clockText = (now = new Date()) => { const t = seoulNow(now); return `${pad(t.hour)}:${pad(t.minute)}` }

/** 달 이동(month는 1~12) */
export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/**
 * 달력 칸: 일요일부터 시작하는 주 단위 배열. 이 달이 아닌 칸은 null.
 * 예: 2026년 11월 1일은 일요일이라 첫 주가 [1..7]이다.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}
