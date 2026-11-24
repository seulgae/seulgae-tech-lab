/**
 * 오락실 메인 오락기에서 고를 수 있는 게임 목록(고르기 화면 카드).
 *
 * @author 길태형
 * @version 1.0, 오락실 게임 고르기
 * @see "None"
 */
export type ArcadeGameId = 'breakout' | 'blocks' | 'snake' | 'sky'

export const ARCADE_GAMES: readonly { id: ArcadeGameId; name: string; icon: string; summary: string; color: string }[] = [
  { id: 'breakout', name: '벽돌 부수기', icon: '🧱', summary: '공을 튕겨 벽돌을 모두 깨요', color: '#f472b6' },
  { id: 'blocks', name: '블록 쌓기', icon: '🟦', summary: '떨어지는 블록으로 가로줄을 채워 지워요', color: '#38bdf8' },
  { id: 'snake', name: '지렁이 사과 먹기', icon: '🍎', summary: '사과를 먹을수록 길어지고 빨라져요', color: '#4ade80' },
  { id: 'sky', name: '하늘 순찰대', icon: '✈️', summary: '적기를 피하며 쏘아 떨어뜨려요', color: '#ffd23f' },
]
