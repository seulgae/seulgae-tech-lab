/**
 * 오락실 메인 오락기의 게임 공통 모양. 규칙(step)은 화면과 분리한 순수 함수라 node 테스트로 검증한다.
 * 화면은 320×240 논리 좌표에 그린다(벽돌 부수기와 같은 크기).
 *
 * @author 길태형
 * @version 1.0, 오락실 게임 고르기
 * @see "None"
 */
export const SCREEN = { width: 320, height: 240 }

/** 누르고 있는 키(held)와 이번 프레임에 새로 누른 키(pressed) */
export type Keys = { left: boolean; right: boolean; up: boolean; down: boolean; action: boolean }
export type RetroInput = { held: Keys; pressed: Keys }
export const NO_KEYS: Keys = { left: false, right: false, up: false, down: false, action: false }

export type Phase = 'ready' | 'playing' | 'over'
/** 소리용 이벤트 */
export type RetroEvent = 'score' | 'hit' | 'over' | 'move' | 'clear'

/** 게임 하나: 시작 상태, 한 프레임 진행, 그리기, 화면 위 표시 */
export type RetroGame<S extends { phase: Phase; score: number }> = {
  id: string
  name: string
  /** 조작 안내 한 줄 */
  help: string
  /** 최고 점수 저장 키(이 브라우저) */
  highKey: string
  create(random: () => number): S
  step(state: S, seconds: number, input: RetroInput, random: () => number): { state: S; events: RetroEvent[] }
  draw(context: CanvasRenderingContext2D, state: S, scale: number): void
  /** 점수 옆에 보일 값(예: LINES 12) */
  stat(state: S): string
}

/** 0.05초 넘게 튄 프레임은 자른다(탭 전환 등). */
export const clampDt = (seconds: number) => Math.min(Math.max(seconds, 0), 0.05)

/**
 * 준비·끝 화면 안내 띠를 그린다.
 *
 * @param context 캔버스
 * @param scale 배율
 * @param message 문구
 */
export function banner(context: CanvasRenderingContext2D, scale: number, message: string) {
  context.fillStyle = 'rgba(11,6,24,.7)'; context.fillRect(0, 100 * scale, SCREEN.width * scale, 40 * scale)
  context.fillStyle = '#ffd23f'; context.font = `bold ${12 * scale}px monospace`; context.textAlign = 'center'
  context.fillText(message, SCREEN.width * scale / 2, 125 * scale)
}
