/**
 * 오락실 내기 게임 API와 화면 연출 계산. 결과는 서버가 정하고 화면은 받은 값을 보여 주기만 한다.
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 */
export type GambleGame = 'ODD_EVEN' | 'LADDER' | 'DICE' | 'SLOT'
export type GambleResult = { game: GambleGame; pick: string; bet: number; numbers: number[]; win: boolean; payout: number; coins: number; betsLeftToday: number }

export const MIN_BET = 1
export const MAX_BET = 20
export const LADDER_ROWS = 6
export const SLOT_SYMBOLS = ['7', '🍒', '🍋', '🔔', '⭐'] as const

/** 게임 안내: 이름, 규칙, 고를 수 있는 값 */
export const GAMES: Record<GambleGame, { name: string; rule: string; picks: { value: string; label: string }[] }> = {
  ODD_EVEN: { name: '홀짝', rule: '주사위 두 개 합이 홀인지 짝인지 맞히면 1.9배', picks: [{ value: 'ODD', label: '홀' }, { value: 'EVEN', label: '짝' }] },
  LADDER: { name: '사다리 타기', rule: '세 줄 중 하나를 골라 당첨 칸에 내려가면 2.8배', picks: [0, 1, 2].map(lane => ({ value: String(lane), label: `${lane + 1}번 줄` })) },
  DICE: { name: '주사위 맞히기', rule: '나올 눈 하나를 맞히면 5.5배', picks: [1, 2, 3, 4, 5, 6].map(face => ({ value: String(face), label: String(face) })) },
  SLOT: { name: '슬롯머신', rule: '7 세 개 50배, 같은 그림 세 개 10배, 두 개면 건 돈의 절반', picks: [] },
}

/** 오락실 오락기(상호작용 id) → 게임 */
export const GAMBLE_MACHINES: Record<string, GambleGame> = {
  'office-3-gamble-odd-even': 'ODD_EVEN', 'office-3-gamble-ladder': 'LADDER', 'office-3-gamble-dice': 'DICE', 'office-3-gamble-slot': 'SLOT',
}

/**
 * 한 판 한다.
 *
 * @param game 게임
 * @param bet 건 동전
 * @param pick 고른 값
 * @returns 결과
 * @exception Error 상태별 안내 문구
 */
export async function playGamble(game: GambleGame, bet: number, pick: string): Promise<GambleResult> {
  const response = await fetch('/api/gamble/play', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ game, bet, pick }),
  })
  if (!response.ok) {
    throw new Error({ 401: '로그인한 연구원만 동전을 걸 수 있어요.', 400: '건 돈과 고른 값을 다시 확인해 주세요.', 409: '동전이 모자라요.', 429: '오늘은 더 할 수 없어요(하루 50판). 내일 다시 와요.' }[response.status] ?? '요청에 실패했어요.')
  }
  return await response.json() as GambleResult
}

/**
 * 사다리 결과에서 고른 줄이 지나간 길(행마다 줄 번호, 처음과 끝 포함).
 *
 * @param start 고른 줄
 * @param rungs 가로줄(행마다 0=0·1번 줄, 1=1·2번 줄, -1=없음)
 * @returns 지나간 줄 번호(행 수 + 1개)
 */
export function ladderPath(start: number, rungs: number[]): number[] {
  const path = [start]
  let lane = start
  for (const rung of rungs) {
    if (rung === 0 && lane <= 1) lane = 1 - lane
    else if (rung === 1 && lane >= 1) lane = 3 - lane
    path.push(lane)
  }
  return path
}

/**
 * 결과 문구.
 *
 * @param result 결과
 * @returns 한 줄 안내
 */
export function resultText(result: GambleResult): string {
  const net = result.payout - result.bet
  if (net > 0) return `당첨! ${result.payout}원을 받았어요 (+${net})`
  if (result.payout > 0) return `아쉽게도 ${result.payout}원만 돌려받았어요 (${net})`
  return `꽝… ${result.bet}원을 잃었어요`
}
