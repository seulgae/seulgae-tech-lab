export const INTRO_STORAGE_KEY = 'seulgae.lab.intro.v1'
export type IntroProgress = 'guided' | 'skipped'

/** 이 브라우저에서 첫 출근을 마쳤는지 확인한다. */
export function readIntroProgress(): IntroProgress | undefined {
  try {
    const saved = globalThis.localStorage.getItem(INTRO_STORAGE_KEY)
    if (saved === 'guided' || saved === 'skipped') return saved
  } catch { /* 저장소를 사용할 수 없으면 이번 방문에 첫 출근을 보여 준다. */ }
}

/** 첫 출근 선택을 브라우저에 저장한다. */
export function saveIntroProgress(progress: IntroProgress) {
  try { globalThis.localStorage.setItem(INTRO_STORAGE_KEY, progress) } catch { /* 이번 방문에서는 장면에 선택이 남는다. */ }
}
