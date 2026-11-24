import type { RoomId } from '../game/maps/rooms.ts'
import type { SkyPhase } from '../game/rooms/timeOfDay.ts'
import { SAMPLE_RATE, SONGS, renderAmbience, renderEffect, renderSong } from './synth.ts'
import type { AmbienceKey, EffectKey } from './synth.ts'
import { effectiveVolume, getAudioSettings, subscribeAudioSettings } from './audioSettings.ts'
import type { AudioCategory, AudioSettings } from './audioSettings.ts'
import { roomSoundscape, spatialPan, spatialVolume } from './soundRules.ts'

/**
 * 연구소 공통 사운드 관리자. Phaser 게임마다 하나만 만들고(장면 재시작에도 유지), Phaser 사운드 매니저로
 * 배경음악·환경음(반복, 교차 페이드)과 효과음(동시 재생 수 제한)을 재생한다.
 * 음원은 synth.ts로 처음 필요할 때 한 번 합성해 Phaser 오디오 캐시에 넣는다(내려받기 없음).
 *
 * Phaser 타입에 직접 의존하지 않고 쓰는 메서드만 구조적으로 받아, node 테스트에서 가짜 사운드 매니저로 검증한다.
 */
export type SoundLike = {
  play(): unknown; stop(): unknown; destroy(): unknown; setVolume(value: number): unknown
  once(event: 'complete', callback: () => void): unknown
}
export type SoundManagerLike = {
  locked: boolean
  context?: { createBuffer(channels: number, length: number, rate: number): { copyToChannel(data: Float32Array, channel: number): void } }
  add(key: string, config?: { loop?: boolean; volume?: number; rate?: number; detune?: number; pan?: number }): SoundLike
  once(event: 'unlocked', callback: () => void): unknown
}
export type GameLike = {
  sound: SoundManagerLike
  cache: { audio: { exists(key: string): boolean; add(key: string, data: unknown): unknown } }
  events: { once(event: 'destroy', callback: () => void): unknown }
}
type Timers = { set(callback: () => void, ms: number): unknown; clear(handle: unknown): void }
type Channel = { key: string | null; sound: SoundLike | null; base: number; fade: unknown; level: number }
type SfxOptions = { volume?: number; rate?: number; detune?: number; pan?: number; priority?: 'normal' | 'low' }

export const MAX_SFX = 8
/** 원격 연구원 발걸음 같은 낮은 우선순위 소리는 이만큼만 동시에 낸다. */
export const MAX_LOW_PRIORITY_SFX = 4
const FADE_OUT_MS = 900
const FADE_IN_MS = 1400
const FADE_STEP_MS = 50

const managers = new WeakMap<object, AudioManager>()
let latest: AudioManager | null = null
type Status = { available: boolean; unlocked: boolean }
let status: Status = { available: false, unlocked: false }
const statusListeners = new Set<(status: Status) => void>()

export const getAudioStatus = () => status
export function subscribeAudioStatus(listener: (status: Status) => void) { statusListeners.add(listener); return () => { statusListeners.delete(listener) } }
function setStatus(next: Status) { status = next; for (const listener of statusListeners) listener(status) }

/** 어디서든 효과음을 낸다. 게임이 없거나 소리가 꺼져 있으면 아무것도 하지 않는다. */
export function playSfx(key: EffectKey, options?: SfxOptions) { latest?.sfx(key, options) }
/** 다른 연구원 위치에서 나는 소리(같은 방만 호출한다). */
export function playSpatialSfx(key: EffectKey, from: { x: number; y: number }, listener: { x: number; y: number }, options?: SfxOptions) {
  latest?.spatial(key, from, listener, options)
}

// 크레딧이 재생되는 동안만 설정값을 건드리지 않고 방의 소리를 끈다.
export function muteRoomAudio() {
  const manager = latest
  manager?.setCinematicMute(true)
  return () => manager?.setCinematicMute(false)
}

export class AudioManager {
  private readonly game: GameLike
  private readonly timers: Timers
  private readonly available: boolean
  private readonly channels: Record<'bgm' | 'ambient', Channel> = {
    bgm: { key: null, sound: null, base: 1, fade: null, level: 0 },
    ambient: { key: null, sound: null, base: 1, fade: null, level: 0 },
  }
  private readonly active = new Set<{ sound: SoundLike; low: boolean }>()
  private readonly fading = new Set<{ sound: SoundLike; timer: unknown }>()
  private wanted: { roomId: RoomId; phase: SkyPhase } | null = null
  private settings: AudioSettings = getAudioSettings()
  private readonly unsubscribe: () => void
  private destroyed = false
  private cinematicMute = false

  /** 게임마다 하나만 만든다. */
  static for(game: GameLike, timers?: Timers) {
    let manager = managers.get(game)
    if (!manager) { manager = new AudioManager(game, timers); managers.set(game, manager) }
    latest = manager
    // 개발 서버에서만 브라우저 콘솔로 재생 상태를 확인할 수 있게 한다(운영 빌드에는 없음).
    if (import.meta.env?.DEV) (globalThis as Record<string, unknown>).__labAudio = manager
    return manager
  }

  constructor(game: GameLike, timers: Timers = { set: (callback, ms) => setTimeout(callback, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) }) {
    this.game = game
    this.timers = timers
    // Web Audio가 없으면(NoAudio·HTML5 폴백) 소리 없이 게임만 돈다.
    this.available = Boolean(game.sound?.context)
    this.unsubscribe = subscribeAudioSettings(settings => { this.settings = settings; this.applyVolumes() })
    setStatus({ available: this.available, unlocked: this.available && !game.sound.locked })
    if (this.available && game.sound.locked) {
      // 브라우저 자동 재생 정책: 첫 클릭·터치·키 입력으로 잠금이 풀린 뒤에만 음악을 시작한다.
      game.sound.once('unlocked', () => { setStatus({ available: true, unlocked: true }); if (this.wanted) this.enterRoom(this.wanted.roomId, this.wanted.phase) })
    }
    game.events.once('destroy', () => this.destroy())
  }

  /** 방에 들어오면 그 방 음악·환경음으로 교차 페이드한다. 같은 곡이면 이어서 재생한다(반복 이동 시 중복 재생 없음). */
  enterRoom(roomId: RoomId, phase: SkyPhase) {
    this.wanted = { roomId, phase }
    if (!this.ready()) return
    const scape = roomSoundscape(roomId, phase)
    this.crossTo('bgm', `bgm:${scape.bgm}`, 1, () => renderSong(SONGS[scape.bgm]!))
    this.crossTo('ambient', `amb:${scape.ambience}`, scape.ambienceGain, () => renderAmbience(scape.ambience))
  }

  setCinematicMute(muted: boolean) {
    this.cinematicMute = muted
    this.applyVolumes()
    if (!muted) return
    for (const item of this.fading) {
      this.timers.clear(item.timer)
      this.safely(() => item.sound.destroy())
    }
    this.fading.clear()
    for (const item of this.active) this.safely(() => item.sound.destroy())
    this.active.clear()
  }

  sfx(key: EffectKey, options: SfxOptions = {}) {
    if (!this.ready() || this.cinematicMute) return
    const volume = effectiveVolume(this.settings, 'sfx') * (options.volume ?? 1)
    if (volume <= 0.001) return
    const low = options.priority === 'low'
    if (this.active.size >= MAX_SFX || (low && [...this.active].filter(item => item.low).length >= MAX_LOW_PRIORITY_SFX)) return
    try {
      const cacheKey = `sfx:${key}`
      this.ensure(cacheKey, () => renderEffect(key))
      const sound = this.game.sound.add(cacheKey, { volume, rate: options.rate ?? 1, detune: options.detune ?? 0, pan: options.pan ?? 0 })
      const entry = { sound, low }
      this.active.add(entry)
      sound.once('complete', () => { this.active.delete(entry); sound.destroy() })
      sound.play()
    } catch { /* 소리 실패는 게임에 영향 없음 */ }
  }

  /** 다른 연구원 소리: 거리가 멀수록 작게, 일정 거리 밖은 내지 않는다. */
  spatial(key: EffectKey, from: { x: number; y: number }, listener: { x: number; y: number }, options: SfxOptions = {}) {
    const dx = from.x - listener.x, dy = from.y - listener.y
    const gain = spatialVolume(dx, dy)
    if (gain <= 0) return
    this.sfx(key, { ...options, volume: (options.volume ?? 1) * gain, pan: spatialPan(dx), priority: 'low' })
  }

  /** 동시에 내고 있는 효과음 수(테스트·진단용) */
  activeEffects() { return this.active.size }
  currentKeys() { return { bgm: this.channels.bgm.key, ambient: this.channels.ambient.key } }
  /** 진단: 오디오 컨텍스트 상태와 채널별 재생 여부·볼륨 */
  debug() {
    const context = this.game.sound.context as { state?: string } | undefined
    const channel = (c: Channel) => ({ key: c.key, playing: (c.sound as { isPlaying?: boolean } | null)?.isPlaying ?? false, volume: (c.sound as { volume?: number } | null)?.volume ?? 0 })
    return { context: context?.state, locked: this.game.sound.locked, bgm: channel(this.channels.bgm), ambient: channel(this.channels.ambient), effects: this.active.size }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.unsubscribe()
    for (const channel of Object.values(this.channels)) { this.timers.clear(channel.fade); this.safely(() => channel.sound?.destroy()) }
    for (const item of this.fading) { this.timers.clear(item.timer); this.safely(() => item.sound.destroy()) }
    for (const item of this.active) this.safely(() => item.sound.destroy())
    this.active.clear(); this.fading.clear()
    if (latest === this) latest = null
    managers.delete(this.game)
  }

  private ready() { return this.available && !this.destroyed && !this.game.sound.locked }

  private volumeFor(category: AudioCategory, base: number) { return this.cinematicMute ? 0 : effectiveVolume(this.settings, category) * base }

  private applyVolumes() {
    for (const [name, channel] of Object.entries(this.channels) as ['bgm' | 'ambient', Channel][]) {
      if (channel.sound) this.safely(() => channel.sound!.setVolume(this.volumeFor(name, channel.base) * channel.level))
    }
  }

  /** 합성한 소리를 AudioBuffer로 바꿔 Phaser 오디오 캐시에 한 번만 넣는다. */
  private ensure(key: string, render: () => Float32Array) {
    if (this.game.cache.audio.exists(key)) return
    const data = render()
    const buffer = this.game.sound.context!.createBuffer(1, data.length, SAMPLE_RATE)
    buffer.copyToChannel(data, 0)
    this.game.cache.audio.add(key, buffer)
  }

  private crossTo(name: 'bgm' | 'ambient', key: string, base: number, render: () => Float32Array) {
    const channel = this.channels[name]
    if (channel.key === key) { channel.base = base; this.applyVolumes(); return }
    // 이전 소리는 따로 페이드아웃한 뒤 정리한다(빠른 반복 이동에도 소리 객체가 쌓이지 않는다).
    if (channel.sound) this.fadeOutAndDestroy(channel.sound, channel.level)
    this.timers.clear(channel.fade)
    channel.key = key; channel.base = base; channel.sound = null; channel.level = 0; channel.fade = null
    try {
      this.ensure(key, render)
      const sound = this.game.sound.add(key, { loop: true, volume: 0 })
      sound.play()
      channel.sound = sound
      const steps = Math.max(1, Math.round(FADE_IN_MS / FADE_STEP_MS))
      let step = 0
      const tick = () => {
        if (this.destroyed || channel.sound !== sound) return
        step++
        channel.level = step / steps
        this.safely(() => sound.setVolume(this.volumeFor(name, channel.base) * channel.level))
        channel.fade = step < steps ? this.timers.set(tick, FADE_STEP_MS) : null
      }
      channel.fade = this.timers.set(tick, FADE_STEP_MS)
    } catch { channel.sound = null }
  }

  private fadeOutAndDestroy(sound: SoundLike, level: number) {
    const name = sound === this.channels.bgm.sound ? 'bgm' : 'ambient'
    const start = this.volumeFor(name, this.channels[name].base) * level
    const steps = Math.max(1, Math.round(FADE_OUT_MS / FADE_STEP_MS))
    const item = { sound, timer: null as unknown }
    this.fading.add(item)
    let step = 0
    const tick = () => {
      step++
      if (step >= steps) { this.fading.delete(item); this.safely(() => { sound.stop(); sound.destroy() }); return }
      this.safely(() => sound.setVolume(start * (1 - step / steps)))
      item.timer = this.timers.set(tick, FADE_STEP_MS)
    }
    item.timer = this.timers.set(tick, FADE_STEP_MS)
  }

  private safely(effect: () => unknown) { try { effect() } catch { /* 이미 정리된 소리 */ } }
}

export type { AmbienceKey, EffectKey }
