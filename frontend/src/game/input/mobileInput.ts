export type DirectionInput = { x: number; y: number }
export const MOBILE_INPUT = { move: 'controls:move', interact: 'controls:interact', reset: 'controls:reset' } as const

/** 원형 패드의 움직임을 기존 키보드와 같은 정수 8방향으로 변환한다. */
export function joystickInput(dx: number, dy: number, radius: number) {
  const distance = Math.hypot(dx, dy)
  const scale = distance > 0 ? Math.min(1, radius / distance) : 0
  const offset = { x: dx * scale, y: dy * scale }
  if (distance < radius * 0.22 || radius <= 0) return { offset, direction: { x: 0, y: 0 } }
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4
  return { offset, direction: { x: Math.round(Math.cos(angle)) || 0, y: Math.round(Math.sin(angle)) || 0 } }
}

/** 키보드와 터치를 합쳐도 서버가 받는 방향은 -1, 0, 1만 사용한다. */
export function combineDirections(keyboard: DirectionInput, touch: DirectionInput): DirectionInput {
  return { x: Math.sign(keyboard.x + touch.x), y: Math.sign(keyboard.y + touch.y) }
}
