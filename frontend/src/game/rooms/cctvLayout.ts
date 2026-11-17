import type { RoomId } from '../maps/rooms.ts'

/** 관제실 모니터 월과 관제 패널의 화면 순서(왼쪽 위부터) */
export const CCTV_ROOMS: RoomId[] = ['lobby', 'development-lab', 'control-room', 'server-room', 'meeting-room', 'outdoor']

/** 월드 좌표(800×600)를 화면 사각형 안의 좌표로 바꾼다. 범위를 벗어나도 화면 안에 붙인다. */
export function feedPoint(screen: { x: number; y: number; width: number; height: number }, x: number, y: number) {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)
  return {
    x: Math.round(screen.x + clamp(x, 800) / 800 * screen.width),
    y: Math.round(screen.y + clamp(y, 600) / 600 * screen.height),
  }
}
