/**
 * 사운드 설정(전체·배경음악·효과음·환경음 볼륨과 켜짐 여부). 이 브라우저(localStorage)에만 저장한다.
 * React 설정 창과 AudioManager가 같은 저장소를 구독한다. Phaser에 의존하지 않아 node 테스트로 검증한다.
 */
export type AudioCategory = 'bgm' | 'sfx' | 'ambient'
export type AudioSettings = {
  master: number; bgm: number; sfx: number; ambient: number
  muted: boolean; bgmOn: boolean; sfxOn: boolean; ambientOn: boolean
}

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  master: 0.8, bgm: 0.3, sfx: 0.6, ambient: 0.4, muted: false, bgmOn: true, sfxOn: true, ambientOn: true,
})
export const AUDIO_SETTINGS_KEY = 'seulgae.audio.settings'

const volume = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100 : fallback
const flag = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback

/** 저장값을 읽는다. 깨진 JSON·범위 밖·타입이 다른 값은 항목별로 기본값을 쓴다. */
export function parseAudioSettings(raw: string | null | undefined): AudioSettings {
  let saved: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(raw ?? 'null') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>
  } catch { /* 깨진 설정은 기본값 */ }
  const d = DEFAULT_AUDIO_SETTINGS
  return {
    master: volume(saved.master, d.master), bgm: volume(saved.bgm, d.bgm), sfx: volume(saved.sfx, d.sfx), ambient: volume(saved.ambient, d.ambient),
    muted: flag(saved.muted, d.muted), bgmOn: flag(saved.bgmOn, d.bgmOn), sfxOn: flag(saved.sfxOn, d.sfxOn), ambientOn: flag(saved.ambientOn, d.ambientOn),
  }
}

/** 실제로 적용할 볼륨(0~1). 전체 음소거나 카테고리를 끄면 0이다. */
export function effectiveVolume(settings: AudioSettings, category: AudioCategory) {
  const on = category === 'bgm' ? settings.bgmOn : category === 'sfx' ? settings.sfxOn : settings.ambientOn
  return settings.muted || !on ? 0 : settings.master * settings[category]
}

type Listener = (settings: AudioSettings) => void
const storage = (): Storage | undefined => { try { return globalThis.localStorage } catch { return undefined } }

let current: AudioSettings = (() => { try { return parseAudioSettings(storage()?.getItem(AUDIO_SETTINGS_KEY)) } catch { return { ...DEFAULT_AUDIO_SETTINGS } } })()
const listeners = new Set<Listener>()

export const getAudioSettings = () => current

export function subscribeAudioSettings(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 일부 항목만 바꿔 저장하고, 구독자(재생 중인 소리)에 바로 반영한다. */
export function updateAudioSettings(patch: Partial<AudioSettings>) {
  current = parseAudioSettings(JSON.stringify({ ...current, ...patch }))
  try { storage()?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(current)) } catch { /* 저장이 막혀도 이번 접속에는 적용 */ }
  for (const listener of listeners) listener(current)
}

export const resetAudioSettings = () => updateAudioSettings({ ...DEFAULT_AUDIO_SETTINGS })
