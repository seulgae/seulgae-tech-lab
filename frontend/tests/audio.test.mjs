import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUDIO_SETTINGS_KEY, DEFAULT_AUDIO_SETTINGS, effectiveVolume, getAudioSettings, parseAudioSettings, resetAudioSettings, updateAudioSettings,
} from '../src/audio/audioSettings.ts'
import { AMBIENCES, EFFECTS, SAMPLE_RATE, SONGS, renderAmbience, renderEffect, renderSong, seededRandom } from '../src/audio/synth.ts'
import { FootstepTracker, footstepSound, roomSoundscape, spatialPan, spatialVolume } from '../src/audio/soundRules.ts'
import { AudioManager, MAX_LOW_PRIORITY_SFX, MAX_SFX, getAudioStatus, playSfx } from '../src/audio/AudioManager.ts'
import { ROOMS } from '../src/game/maps/rooms.ts'

/** Phaser 사운드 매니저·캐시·이벤트의 최소 가짜 */
function fakeGame({ locked = false } = {}) {
  const handlers = {}
  const cache = new Map()
  const sounds = []
  const sound = {
    locked,
    context: { createBuffer: (channels, length, rate) => ({ channels, length, rate, copyToChannel() {} }) },
    add(key, config = {}) {
      const s = {
        key, config, volume: config.volume ?? 1, playing: false, destroyed: false, onComplete: null,
        play() { this.playing = true }, stop() { this.playing = false }, destroy() { this.destroyed = true; this.playing = false },
        setVolume(value) { this.volume = value }, once(_event, callback) { this.onComplete = callback },
      }
      sounds.push(s)
      return s
    },
    once(event, callback) { handlers[event] = callback },
  }
  const game = { sound, cache: { audio: { exists: key => cache.has(key), add: (key, value) => cache.set(key, value) } }, events: { once(event, callback) { handlers[`game:${event}`] = callback } } }
  return { game, sounds, cache, handlers }
}
/** setTimeout 대신 직접 돌리는 타이머 */
function manualTimers() {
  let queue = []
  return {
    set(callback) { const handle = { callback }; queue.push(handle); return handle },
    clear(handle) { queue = queue.filter(item => item !== handle) },
    runAll(limit = 500) { for (let i = 0; i < limit && queue.length; i++) { const current = queue; queue = []; current.forEach(item => item.callback()) } },
  }
}
const live = (sounds, prefix) => sounds.filter(s => s.key.startsWith(prefix) && !s.destroyed)

test('사운드 설정: 기본값(전체 80·음악 30·효과 60·환경 40), 잘못된 값은 항목별 기본값, 즉시 저장·반영', () => {
  assert.deepEqual({ ...DEFAULT_AUDIO_SETTINGS }, { master: 0.8, bgm: 0.3, sfx: 0.6, ambient: 0.4, muted: false, bgmOn: true, sfxOn: true, ambientOn: true })
  assert.deepEqual(parseAudioSettings('{broken'), { ...DEFAULT_AUDIO_SETTINGS })
  assert.deepEqual(parseAudioSettings(JSON.stringify({ master: 5, bgm: -1, sfx: 'loud', muted: 'yes', ambientOn: false })),
    { ...DEFAULT_AUDIO_SETTINGS, master: 1, bgm: 0, ambientOn: false })
  assert.equal(effectiveVolume(DEFAULT_AUDIO_SETTINGS, 'bgm'), 0.8 * 0.3)
  assert.equal(effectiveVolume({ ...DEFAULT_AUDIO_SETTINGS, muted: true }, 'sfx'), 0)
  assert.equal(effectiveVolume({ ...DEFAULT_AUDIO_SETTINGS, ambientOn: false }, 'ambient'), 0)
  const saved = new Map()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } })
  try {
    updateAudioSettings({ bgm: 0.55 })
    assert.equal(getAudioSettings().bgm, 0.55)
    assert.equal(JSON.parse(saved.get(AUDIO_SETTINGS_KEY)).bgm, 0.55, '새로고침 후에도 유지되도록 저장한다')
    resetAudioSettings()
    assert.deepEqual(getAudioSettings(), { ...DEFAULT_AUDIO_SETTINGS })
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('합성 음원: 모든 방 음악·환경음·효과음이 유한하고 범위 안이며, 같은 씨앗이면 같은 소리', () => {
  for (const id of Object.keys(ROOMS)) assert.ok(SONGS[roomSoundscape(id, 'noon').bgm], `${id} 음악`)
  for (const [id, spec] of Object.entries(SONGS)) {
    const song = renderSong(spec)
    const seconds = song.length / SAMPLE_RATE
    assert.ok(seconds > 15 && seconds < 40, `${id}: ${seconds}s`)
    assert.ok(song.every(Number.isFinite) && song.every(v => Math.abs(v) <= 0.6001), id)
  }
  for (const key of AMBIENCES) { const a = renderAmbience(key); assert.ok(a.length > SAMPLE_RATE * 9 && a.every(v => Math.abs(v) <= 0.5001), key) }
  for (const key of EFFECTS) {
    const e = renderEffect(key)
    assert.ok(e.length <= SAMPLE_RATE * 1.7 && e.every(Number.isFinite), key)
    assert.ok(e.some(v => Math.abs(v) > 0.1), `${key}: 들리는 소리`)
  }
  assert.deepEqual(Array.from(renderEffect('click').slice(0, 50)), Array.from(renderEffect('click').slice(0, 50)))
  const a = seededRandom(1), b = seededRandom(1)
  assert.equal(a(), b())
})

test('방별 사운드: 방마다 음악, 서버실 팬·개발실 타자·관제실 전자음, 바깥은 밤에 귀뚜라미', () => {
  assert.deepEqual(roomSoundscape('server-room', 'noon'), { bgm: 'server-room', ambience: 'server-fan', ambienceGain: 1 })
  assert.equal(roomSoundscape('development-lab', 'noon').ambience, 'keyboard')
  assert.equal(roomSoundscape('control-room', 'noon').ambience, 'electronics')
  assert.equal(roomSoundscape('outdoor', 'noon').ambience, 'meadow-day')
  assert.equal(roomSoundscape('outdoor', 'evening').ambience, 'meadow-night')
  for (const id of Object.keys(ROOMS)) assert.ok(SONGS[roomSoundscape(id, 'noon').bgm], id)
  assert.equal(roomSoundscape('office-3', 'noon').ambience, 'electronics')
})

test('발걸음: 실제로 움직인 거리만큼, 막히면·멈추면 소리 없음, 순간이동 무시, 바닥 재질', () => {
  const steps = new FootstepTracker(24)
  assert.equal(steps.update(100, 100), false, '첫 위치는 기준만 잡는다')
  assert.equal(steps.update(102, 100), true, '움직이기 시작하면 바로 한 발')
  let count = 0
  for (let x = 104; x <= 200; x += 2) if (steps.update(x, 100)) count++
  assert.equal(count, 4, '약 24px마다 한 발')
  assert.equal(steps.update(200, 100), false, '막혀서 좌표가 그대로면 소리 없음')
  assert.equal(steps.update(202, 100), true, '다시 걸으면 첫 발부터')
  assert.equal(steps.update(400, 300), false, '서버 보정·방 이동 같은 순간이동은 무시')
  assert.equal(footstepSound('lobby', 400, 400), 'footstep-carpet', '로비 레드 카펫')
  assert.equal(footstepSound('lobby', 100, 400), 'footstep')
  assert.equal(footstepSound('outdoor', 100, 400), 'footstep-grass')
  assert.equal(footstepSound('outdoor', 670, 355), 'footstep-wood', '다리 위')
  assert.equal(footstepSound('outdoor', 400, 480), 'footstep', '흙길')
})

test('거리 감쇠: 가까울수록 크고(최대 0.6) 멀면 0, 좌우 위치', () => {
  assert.equal(spatialVolume(0, 0), 0.6)
  assert.ok(spatialVolume(100, 0) > spatialVolume(200, 0))
  assert.equal(spatialVolume(320, 0), 0)
  assert.equal(spatialVolume(500, 500), 0)
  assert.equal(spatialPan(-800), -1)
  assert.equal(spatialPan(200), 0.5)
})

test('AudioManager: 첫 클릭 전에는 재생하지 않고, 잠금이 풀리면 방 음악·환경음을 반복 재생한다', () => {
  const { game, sounds, handlers } = fakeGame({ locked: true })
  const timers = manualTimers()
  const audio = new AudioManager(game, timers)
  audio.enterRoom('lobby', 'noon')
  audio.sfx('click')
  assert.equal(sounds.length, 0, '자동 재생 정책: 사용자 입력 전에는 조용하다')
  assert.deepEqual(getAudioStatus(), { available: true, unlocked: false })
  game.sound.locked = false
  handlers.unlocked()
  assert.equal(getAudioStatus().unlocked, true)
  assert.deepEqual(sounds.map(s => [s.key, s.config.loop, s.playing]), [['bgm:lobby', true, true], ['amb:room-tone', true, true]])
  timers.runAll()
  assert.ok(Math.abs(sounds[0].volume - 0.8 * 0.3) < 1e-9, '페이드인 끝에 설정 볼륨')
  audio.destroy()
})

test('AudioManager: 방 이동은 교차 페이드, 같은 방은 이어서, 빠른 반복 이동에도 곡이 겹치지 않는다', () => {
  const { game, sounds, cache } = fakeGame()
  const timers = manualTimers()
  const audio = new AudioManager(game, timers)
  audio.enterRoom('lobby', 'noon'); timers.runAll()
  audio.enterRoom('lobby', 'noon')
  assert.equal(live(sounds, 'bgm:').length, 1, '같은 방에 다시 들어와도 새로 틀지 않는다')
  for (const room of ['development-lab', 'lobby', 'server-room', 'outdoor', 'control-room']) audio.enterRoom(room, 'noon')
  assert.equal(audio.currentKeys().bgm, 'bgm:control-room')
  timers.runAll()
  assert.deepEqual(live(sounds, 'bgm:').map(s => s.key), ['bgm:control-room'], '이전 곡은 페이드아웃 후 정리')
  assert.deepEqual(live(sounds, 'amb:').map(s => s.key), ['amb:electronics'])
  assert.equal([...cache.keys()].filter(key => key === 'bgm:lobby').length, 1, '한 번 합성한 곡은 캐시에서 재사용')
  audio.destroy()
  assert.equal(live(sounds, '').length, 0, '정리하면 모든 소리를 없앤다')
})

test('AudioManager: 효과음 동시 재생 수 제한, 원격 소리는 거리·우선순위 제한, 설정 즉시 반영', () => {
  const { game, sounds } = fakeGame()
  const timers = manualTimers()
  const audio = AudioManager.for(game, timers)
  for (let i = 0; i < 12; i++) playSfx('click')
  assert.equal(audio.activeEffects(), MAX_SFX)
  sounds.filter(s => s.key === 'sfx:click').forEach(s => s.onComplete?.())
  assert.equal(audio.activeEffects(), 0, '끝난 효과음은 정리한다')
  audio.spatial('footstep', { x: 700, y: 500 }, { x: 100, y: 100 })
  assert.equal(audio.activeEffects(), 0, '멀리 있는 연구원 발걸음은 들리지 않는다')
  for (let i = 0; i < 8; i++) audio.spatial('footstep', { x: 140, y: 100 }, { x: 100, y: 100 })
  assert.equal(audio.activeEffects(), MAX_LOW_PRIORITY_SFX)
  const step = sounds.at(-1)
  assert.ok(step.config.volume > 0 && step.config.volume < 0.6 * 0.8 && step.config.pan > 0)

  audio.enterRoom('lobby', 'noon'); timers.runAll()
  const bgm = live(sounds, 'bgm:')[0]
  updateAudioSettings({ bgm: 0.5 })
  assert.ok(Math.abs(bgm.volume - 0.8 * 0.5) < 1e-9, '재생 중인 음악에 바로 반영')
  updateAudioSettings({ muted: true })
  assert.equal(bgm.volume, 0)
  const before = sounds.length
  playSfx('click')
  assert.equal(sounds.length, before, '음소거 중에는 효과음을 만들지 않는다')
  resetAudioSettings()
  audio.destroy()
  playSfx('click')
  assert.equal(sounds.length, before, '정리 뒤에는 아무것도 재생하지 않는다')
})

test('Web Audio가 없으면 소리 없이 조용히 넘어간다', () => {
  const { game } = fakeGame()
  delete game.sound.context
  const audio = new AudioManager(game, manualTimers())
  assert.doesNotThrow(() => { audio.enterRoom('lobby', 'noon'); audio.sfx('click') })
  assert.equal(getAudioStatus().available, false)
  audio.destroy()
})
