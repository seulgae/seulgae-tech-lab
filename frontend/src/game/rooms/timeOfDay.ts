/**
 * 현재 시각으로 창밖 하늘 분위기를 고른다. Phaser에 의존하지 않아 node 테스트로 검증한다.
 * 새벽 0~5시, 이른 아침 5~8시, 아침 8~11시, 점심 11~16시, 노을 16~19시, 어두워지는 저녁 19~24시.
 */
export type SkyPhase = 'dawn' | 'early-morning' | 'morning' | 'noon' | 'sunset' | 'evening'
export const SKY_PHASES: SkyPhase[] = ['dawn', 'early-morning', 'morning', 'noon', 'sunset', 'evening']
export const SKY_LABELS: Record<SkyPhase, string> = {
  dawn: '새벽', 'early-morning': '이른 아침', morning: '아침', noon: '점심', sunset: '노을', evening: '저녁',
}

/** 위·가운데·지평선 하늘색, 해·달·별, 창으로 들어오는 빛 색과 세기 */
export type SkyPalette = {
  top: string; middle: string; horizon: string
  sun?: { color: string; x: number; y: number }
  moon?: { x: number; y: number }
  stars: number
  light: string; lightAlpha: number
  /** 밤일수록 실내등을 밝혀 대비를 맞춘다. */
  indoor: number
}

export const SKY_PALETTES: Record<SkyPhase, SkyPalette> = {
  dawn: { top: '#0b1026', middle: '#1b2147', horizon: '#3a3466', moon: { x: 26, y: 5 }, stars: 9, light: '#8ea2ff', lightAlpha: 0.08, indoor: 1.3 },
  'early-morning': { top: '#5b7fc0', middle: '#f2a7a0', horizon: '#ffd39a', sun: { color: '#fff1b8', x: 8, y: 14 }, stars: 0, light: '#ffcf9e', lightAlpha: 0.16, indoor: 1 },
  morning: { top: '#6fb6ee', middle: '#9fd0f0', horizon: '#d6efff', sun: { color: '#fff7d6', x: 10, y: 6 }, stars: 0, light: '#fff6dc', lightAlpha: 0.2, indoor: 0.85 },
  noon: { top: '#3f9be6', middle: '#78bdf0', horizon: '#b8e2ff', sun: { color: '#ffffff', x: 18, y: 3 }, stars: 0, light: '#ffffff', lightAlpha: 0.24, indoor: 0.75 },
  sunset: { top: '#5b4b8a', middle: '#ef7d57', horizon: '#ffcd75', sun: { color: '#ffb35c', x: 27, y: 13 }, stars: 0, light: '#ff9e5e', lightAlpha: 0.2, indoor: 1 },
  evening: { top: '#141a3a', middle: '#2c2f5e', horizon: '#5a4a7a', moon: { x: 6, y: 4 }, stars: 6, light: '#7d86c9', lightAlpha: 0.1, indoor: 1.25 },
}

export function skyPhase(date: Date): SkyPhase {
  const hour = date.getHours() + date.getMinutes() / 60
  if (hour < 5) return 'dawn'
  if (hour < 8) return 'early-morning'
  if (hour < 11) return 'morning'
  if (hour < 16) return 'noon'
  if (hour < 19) return 'sunset'
  return 'evening'
}

/** 벽시계 바늘 각도(라디안, 12시 방향 0, 시계 방향) */
export function clockAngles(date: Date) {
  const seconds = date.getSeconds(), minutes = date.getMinutes() + seconds / 60, hours = date.getHours() % 12 + minutes / 60
  return { hour: hours / 12 * Math.PI * 2, minute: minutes / 60 * Math.PI * 2, second: seconds / 60 * Math.PI * 2 }
}

export function clockLabel(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
