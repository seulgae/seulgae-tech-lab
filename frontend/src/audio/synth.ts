/**
 * 연구소 사운드를 코드로 합성한다(음원 파일·외부 라이선스 없음). 결과는 22,050Hz 모노 Float32Array이며
 * 브라우저에서는 AudioBuffer로 바꿔 Phaser 사운드 매니저로 재생한다. Phaser에 의존하지 않아 node 테스트로 검증한다.
 *
 * 콘셉트: 따뜻한 픽셀아트 RPG의 잔잔한 로파이. 날카로운 고음·큰 타격음을 피하고, 모든 소리를 부드러운 저역 필터로 감싼다.
 */
export const SAMPLE_RATE = 22050
const TAU = Math.PI * 2
const samples = (seconds: number) => Math.max(1, Math.round(seconds * SAMPLE_RATE))
const mtof = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** 같은 결과가 나오도록 씨앗을 고정한 난수(mulberry32) */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Wave = 'sine' | 'triangle' | 'soft-square' | 'epiano' | 'bell'
type ToneOptions = { wave?: Wave; attack?: number; decay?: number; gain?: number; vibrato?: number; glideTo?: number }

/** 음 하나를 더한다. decay는 지수 감쇠 시간상수(초)이고, 끝 20ms는 딸깍임이 없게 줄인다. */
function addTone(out: Float32Array, start: number, duration: number, freq: number, o: ToneOptions = {}) {
  const { wave = 'sine', attack = 0.01, decay = duration, gain = 0.3, vibrato = 0, glideTo } = o
  const from = samples(start), count = samples(duration), tail = samples(0.02)
  let phase = 0, phase2 = 0
  for (let i = 0; i < count && from + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const f = (glideTo ? freq + (glideTo - freq) * (i / count) : freq) * (1 + vibrato * Math.sin(TAU * 5 * t))
    phase += f / SAMPLE_RATE; phase2 += 2 * f / SAMPLE_RATE
    const p = phase % 1
    let v: number
    if (wave === 'triangle') v = 1 - 4 * Math.abs(p - 0.5)
    else if (wave === 'soft-square') v = Math.tanh(4 * Math.sin(TAU * p)) * 0.7
    else if (wave === 'epiano') v = Math.sin(TAU * p) + 0.35 * Math.sin(TAU * phase2) * Math.exp(-t * 6)
    else if (wave === 'bell') v = Math.sin(TAU * p) + 0.4 * Math.sin(TAU * p * 2.76) * Math.exp(-t * 3) + 0.2 * Math.sin(TAU * p * 5.4) * Math.exp(-t * 8)
    else v = Math.sin(TAU * p)
    const env = Math.min(1, t / attack) * Math.exp(-t / decay) * (i > count - tail ? (count - i) / tail : 1)
    out[from + i]! += v * env * gain
  }
}

/** 카플러스-스트롱 현 뜯기(어쿠스틱 기타 느낌) */
function addPluck(out: Float32Array, start: number, duration: number, freq: number, gain: number, random: () => number) {
  const period = Math.max(2, Math.round(SAMPLE_RATE / freq))
  const ring = Float32Array.from({ length: period }, () => random() * 2 - 1)
  const from = samples(start), count = samples(duration), tail = samples(0.03)
  let index = 0
  for (let i = 0; i < count && from + i < out.length; i++) {
    const next = (index + 1) % period
    const value = ring[index]!
    ring[index] = 0.497 * (value + ring[next]!)
    index = next
    out[from + i]! += value * gain * (i > count - tail ? (count - i) / tail : 1)
  }
}

type NoiseOptions = { gain?: number; lowpass?: number; highpass?: number; attack?: number; decay?: number; color?: 'white' | 'brown' }
/** 걸러 낸 잡음 한 덩어리(발걸음·문·바람·물소리 재료) */
function addNoise(out: Float32Array, start: number, duration: number, random: () => number, o: NoiseOptions = {}) {
  const { gain = 0.3, lowpass = 0, highpass = 0, attack = 0.002, decay = duration, color = 'white' } = o
  const from = samples(start), count = samples(duration), tail = samples(0.01)
  const lp = lowpass ? 1 - Math.exp(-TAU * lowpass / SAMPLE_RATE) : 1
  const hp = highpass ? Math.exp(-TAU * highpass / SAMPLE_RATE) : 0
  let low = 0, brown = 0, prevIn = 0, high = 0
  for (let i = 0; i < count && from + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    let v = random() * 2 - 1
    if (color === 'brown') { brown = (brown + v * 0.08) * 0.995; v = brown * 3 }
    low += lp * (v - low)
    high = highpass ? hp * (high + low - prevIn) : low
    prevIn = low
    const env = Math.min(1, t / attack) * Math.exp(-t / decay) * (i > count - tail ? (count - i) / tail : 1)
    out[from + i]! += high * env * gain
  }
}

function lowpassInPlace(out: Float32Array, cutoff: number) {
  const a = 1 - Math.exp(-TAU * cutoff / SAMPLE_RATE)
  let y = 0
  for (let i = 0; i < out.length; i++) { y += a * (out[i]! - y); out[i] = y }
}

/** 짧은 잔향(피드백 지연 두 개)으로 방 울림을 준다. */
function roomReverb(out: Float32Array, mix: number) {
  if (mix <= 0) return
  for (const [delay, feedback] of [[0.043, 0.35], [0.071, 0.3]] as const) {
    const d = samples(delay)
    for (let i = d; i < out.length; i++) out[i]! += out[i - d]! * feedback * mix
  }
}

/** 최대 진폭을 peak로 맞춘다(무음은 그대로). */
export function normalize(out: Float32Array, peak: number) {
  let max = 0
  for (const v of out) max = Math.max(max, Math.abs(v))
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] = out[i]! / max * peak
  return out
}

/** 끝에서 넘친 꼬리를 처음에 더해 끊김 없이 반복되게 한다. 결과 길이는 loopLength다. */
function wrapTail(out: Float32Array, loopLength: number) {
  const looped = out.slice(0, loopLength)
  for (let i = loopLength; i < out.length; i++) looped[i - loopLength]! += out[i]!
  return looped
}

/** 잡음 환경음: 끝 0.5초를 처음과 교차해 이음매를 없앤다. */
function seamless(out: Float32Array, fadeSeconds = 0.5) {
  const n = samples(fadeSeconds), length = out.length - n
  const looped = out.slice(0, length)
  for (let i = 0; i < n; i++) { const t = i / n; looped[i] = out[i]! * t + out[length + i]! * (1 - t) }
  return looped
}

// ───────────────────────── 배경음악 ─────────────────────────

type Comp = 'epiano' | 'pad' | 'arp' | 'pluck' | 'bell'
type SongSpec = {
  bpm: number; chords: number[][]; comp: Comp; bass: 'root' | 'walk' | 'pulse'
  drums: 'lofi' | 'brush' | 'tick' | 'none'; melody: Wave | null; crackle: number; brightness: number; reverb: number; seed: number
}

/** 방별 배경음악. chords는 마디별 화음(MIDI), 두 번 반복해 8마디가 된다. */
export const SONGS: Record<string, SongSpec> = {
  // 중앙 로비: 따뜻한 일렉트릭 피아노 로파이(Cmaj7–Am7–Dm7–G7)
  lobby: { bpm: 74, chords: [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]], comp: 'epiano', bass: 'root', drums: 'lofi', melody: 'epiano', crackle: 0.012, brightness: 2600, reverb: 0.5, seed: 11 },
  // 개발 연구실: 집중용 전자 아르페지오(Am9–Fmaj7–C–G6)
  'development-lab': { bpm: 84, chords: [[45, 48, 52, 59], [41, 45, 48, 52], [48, 52, 55, 60], [43, 47, 50, 52]], comp: 'arp', bass: 'pulse', drums: 'tick', melody: null, crackle: 0, brightness: 2200, reverb: 0.35, seed: 23 },
  // 서버실: 낮고 차가운 패드(Dm–Bb–F–C)
  'server-room': { bpm: 64, chords: [[38, 45, 50, 53], [34, 46, 50, 53], [41, 45, 48, 53], [36, 43, 48, 52]], comp: 'pad', bass: 'root', drums: 'none', melody: 'bell', crackle: 0, brightness: 1500, reverb: 0.6, seed: 37 },
  // 회의실: 잔잔한 재즈 피아노와 워킹 베이스(Dm7–G7–Cmaj7–A7)
  'meeting-room': { bpm: 88, chords: [[50, 53, 57, 60], [43, 47, 50, 53], [48, 52, 55, 59], [45, 49, 52, 55]], comp: 'epiano', bass: 'walk', drums: 'brush', melody: 'epiano', crackle: 0.006, brightness: 2400, reverb: 0.45, seed: 41 },
  // 관제실: 차분하고 미래적인 벨·아르페지오(Em–Cmaj7–G–D)
  'control-room': { bpm: 78, chords: [[40, 47, 52, 55], [36, 48, 52, 55], [43, 47, 50, 55], [38, 45, 50, 54]], comp: 'bell', bass: 'pulse', drums: 'tick', melody: null, crackle: 0, brightness: 2000, reverb: 0.5, seed: 53 },
  // 바깥 초원: 어쿠스틱 기타 아르페지오(G–D–Em–C)
  outdoor: { bpm: 70, chords: [[43, 50, 55, 59], [38, 50, 54, 57], [40, 47, 52, 55], [36, 48, 52, 55]], comp: 'pluck', bass: 'root', drums: 'none', melody: 'triangle', crackle: 0, brightness: 3000, reverb: 0.3, seed: 67 },
}

export function renderSong(spec: SongSpec) {
  const beat = 60 / spec.bpm, bar = beat * 4, bars = spec.chords.length * 2
  const loopLength = samples(bar * bars)
  const out = new Float32Array(loopLength + samples(3))
  const random = seededRandom(spec.seed)
  for (let b = 0; b < bars; b++) {
    const chord = spec.chords[b % spec.chords.length]!
    const t0 = b * bar
    // 반주
    if (spec.comp === 'epiano') {
      for (const [at, length] of [[0, 1.6], [2.5, 1.4]] as const) for (const note of chord) addTone(out, t0 + at * beat + random() * 0.02, length * beat, mtof(note + 12), { wave: 'epiano', attack: 0.008, decay: 0.9, gain: 0.07 })
    } else if (spec.comp === 'pad') {
      for (const note of chord) addTone(out, t0, bar * 1.05, mtof(note + 12), { wave: 'triangle', attack: 0.8, decay: 6, gain: 0.05, vibrato: 0.003 })
    } else if (spec.comp === 'arp') {
      for (let s = 0; s < 8; s++) addTone(out, t0 + s * beat / 2, beat / 2, mtof(chord[[0, 1, 2, 3, 2, 1, 3, 2][s]!]! + 24), { wave: 'triangle', attack: 0.005, decay: 0.18, gain: 0.08 })
    } else if (spec.comp === 'pluck') {
      for (let s = 0; s < 8; s++) addPluck(out, t0 + s * beat / 2, beat * 1.5, mtof(chord[[0, 2, 1, 3, 2, 1, 3, 2][s]!]! + 12), 0.22, random)
    } else {
      for (let s = 0; s < 4; s++) addTone(out, t0 + s * beat, beat * 2, mtof(chord[(s + b) % chord.length]! + 24), { wave: 'bell', attack: 0.004, decay: 0.7, gain: 0.07 })
      for (const note of chord) addTone(out, t0, bar, mtof(note + 12), { wave: 'triangle', attack: 0.6, decay: 5, gain: 0.025 })
    }
    // 베이스
    const root = chord[0]! - 12
    if (spec.bass === 'root') { addTone(out, t0, beat * 1.8, mtof(root), { wave: 'sine', decay: 1.2, gain: 0.22 }); addTone(out, t0 + 2 * beat, beat * 1.6, mtof(root), { wave: 'sine', decay: 1, gain: 0.16 }) }
    else if (spec.bass === 'walk') for (let s = 0; s < 4; s++) addTone(out, t0 + s * beat, beat * 0.95, mtof(root + [0, 4, 7, 10][s]!), { wave: 'triangle', decay: 0.5, gain: 0.2 })
    else for (let s = 0; s < 8; s++) addTone(out, t0 + s * beat / 2, beat * 0.45, mtof(root), { wave: 'soft-square', decay: 0.15, gain: 0.06 })
    // 드럼(아주 작게)
    for (let s = 0; s < 8; s++) {
      const at = t0 + s * beat / 2 + (s % 2 ? beat * 0.08 : 0)
      if (spec.drums === 'lofi') {
        if (s === 0 || s === 5) addTone(out, at, 0.3, 110, { glideTo: 42, decay: 0.12, gain: 0.35 })
        if (s === 2 || s === 6) addNoise(out, at, 0.16, random, { lowpass: 2600, highpass: 400, decay: 0.06, gain: 0.12 })
        addNoise(out, at, 0.05, random, { highpass: 5000, decay: 0.018, gain: s % 2 ? 0.03 : 0.05 })
      } else if (spec.drums === 'brush') {
        if (s === 2 || s === 6) addNoise(out, at, 0.22, random, { lowpass: 3500, highpass: 900, attack: 0.03, decay: 0.08, gain: 0.08 })
        if (s % 2 === 0) addNoise(out, at, 0.06, random, { highpass: 6000, decay: 0.02, gain: 0.03 })
      } else if (spec.drums === 'tick') {
        addNoise(out, at, 0.03, random, { highpass: 7000, decay: 0.01, gain: s % 2 ? 0.02 : 0.035 })
        if (s === 0) addTone(out, at, 0.25, 90, { glideTo: 45, decay: 0.1, gain: 0.18 })
      }
    }
    // 가끔 떠오르는 멜로디(펜타토닉 위주로 화음 구성음에서 고른다)
    if (spec.melody) for (let s = 0; s < 4; s++) {
      if (random() > 0.42) continue
      const note = chord[Math.floor(random() * chord.length)]! + 24 + (random() < 0.3 ? 2 : 0)
      addTone(out, t0 + s * beat + (random() < 0.4 ? beat / 2 : 0), beat * 1.4, mtof(note), { wave: spec.melody, attack: 0.01, decay: 0.6, gain: 0.08 })
    }
  }
  // 레코드 잡음(로파이 질감)
  if (spec.crackle) for (let i = 0; i < out.length; i++) if (random() < spec.crackle * 0.02) out[i]! += (random() - 0.5) * 0.15
  roomReverb(out, spec.reverb)
  lowpassInPlace(out, spec.brightness)
  return normalize(wrapTail(out, loopLength), 0.6)
}

// ───────────────────────── 환경음 ─────────────────────────

export const AMBIENCES = ['room-tone', 'keyboard', 'server-fan', 'electronics', 'clock', 'meadow-day', 'meadow-night'] as const
export type AmbienceKey = typeof AMBIENCES[number]

export function renderAmbience(key: AmbienceKey) {
  const length = 10
  const out = new Float32Array(samples(length + 0.5))
  const random = seededRandom(key.length * 97 + key.charCodeAt(0))
  if (key === 'room-tone') addNoise(out, 0, length + 0.5, random, { color: 'brown', lowpass: 500, gain: 0.25 })
  if (key === 'server-fan') {
    addNoise(out, 0, length + 0.5, random, { color: 'brown', lowpass: 900, gain: 0.5 })
    addTone(out, 0, length + 0.5, 60, { gain: 0.08, attack: 0.5, decay: 999 }); addTone(out, 0, length + 0.5, 120, { gain: 0.05, attack: 0.5, decay: 999, vibrato: 0.002 })
  }
  if (key === 'electronics') {
    addTone(out, 0, length + 0.5, 100, { gain: 0.04, attack: 0.5, decay: 999 })
    addNoise(out, 0, length + 0.5, random, { color: 'brown', lowpass: 600, gain: 0.15 })
    for (let t = 0.6; t < length; t += 1.4 + random() * 1.6) addTone(out, t, 0.12, [1320, 1560, 1760][Math.floor(random() * 3)]!, { wave: 'sine', decay: 0.05, gain: 0.03 })
  }
  if (key === 'keyboard') {
    addNoise(out, 0, length + 0.5, random, { color: 'brown', lowpass: 400, gain: 0.12 })
    // 타자 몇 묶음과 쉬는 시간
    for (let t = 0.3; t < length - 0.5;) {
      const burst = 4 + Math.floor(random() * 10)
      for (let k = 0; k < burst; k++, t += 0.08 + random() * 0.12) addNoise(out, t, 0.04, random, { highpass: 1800, lowpass: 6000, decay: 0.008, gain: 0.2 + random() * 0.1 })
      t += 0.8 + random() * 1.5
    }
  }
  if (key === 'clock') {
    addNoise(out, 0, length + 0.5, random, { color: 'brown', lowpass: 450, gain: 0.18 })
    for (let t = 0.2; t < length; t += 1) addNoise(out, t, 0.03, random, { highpass: 2500, decay: 0.006, gain: 0.25 })
  }
  if (key === 'meadow-day' || key === 'meadow-night') {
    // 바람: 느리게 오르내리는 저역 잡음, 시냇물: 대역 잡음
    const wind = new Float32Array(out.length)
    addNoise(wind, 0, length + 0.5, random, { color: 'brown', lowpass: 700, gain: 0.35 })
    for (let i = 0; i < out.length; i++) out[i]! += wind[i]! * (0.6 + 0.4 * Math.sin(TAU * i / SAMPLE_RATE / 5.25))
    addNoise(out, 0, length + 0.5, random, { lowpass: 3200, highpass: 900, gain: 0.08 })
    if (key === 'meadow-day') for (let t = 0.8; t < length - 0.6; t += 1.6 + random() * 2.4) {
      // 새 지저귐: 짧게 오르내리는 고음 두세 번
      const base = 2400 + random() * 1200
      for (let k = 0; k < 2 + Math.floor(random() * 2); k++) addTone(out, t + k * 0.13, 0.09, base, { glideTo: base * 1.35, decay: 0.05, gain: 0.05 })
    } else for (let t = 0.1; t < length - 0.3; t += 0.45 + random() * 0.25) {
      // 귀뚜라미: 빠르게 떨리는 고음
      addTone(out, t, 0.12, 4300 + random() * 200, { decay: 0.08, gain: 0.025, vibrato: 0.02 })
    }
  }
  return normalize(seamless(out), 0.5)
}

// ───────────────────────── 효과음 ─────────────────────────

export const EFFECTS = [
  'footstep', 'footstep-carpet', 'footstep-grass', 'footstep-wood', 'door-open', 'door-close', 'transition', 'chair-sit', 'chair-stand',
  'typing', 'marker', 'kiosk', 'leaves', 'page', 'click', 'panel-open', 'panel-close', 'chat', 'success', 'error', 'notify', 'announce',
  'beep', 'alarm', 'sip', 'munch', 'splash', 'plop', 'cast',
] as const
export type EffectKey = typeof EFFECTS[number]

export function renderEffect(key: EffectKey) {
  const random = seededRandom(key.length * 131 + key.charCodeAt(key.length - 1))
  const out = new Float32Array(samples(key === 'announce' ? 1.6 : key === 'alarm' ? 1.1 : 0.7))
  switch (key) {
    case 'footstep': addNoise(out, 0, 0.09, random, { lowpass: 1400, highpass: 120, decay: 0.025, gain: 0.8 }); addTone(out, 0, 0.08, 140, { glideTo: 80, decay: 0.03, gain: 0.4 }); break
    case 'footstep-carpet': addNoise(out, 0, 0.1, random, { lowpass: 500, attack: 0.01, decay: 0.035, gain: 0.7 }); break
    case 'footstep-grass': addNoise(out, 0, 0.12, random, { lowpass: 3800, highpass: 1500, attack: 0.008, decay: 0.04, gain: 0.45 }); break
    case 'footstep-wood': addNoise(out, 0, 0.08, random, { lowpass: 2200, highpass: 200, decay: 0.02, gain: 0.6 }); addTone(out, 0, 0.12, 210, { decay: 0.04, gain: 0.35 }); break
    case 'door-open':
      addTone(out, 0, 0.45, 170, { wave: 'soft-square', glideTo: 260, attack: 0.05, decay: 0.3, gain: 0.08, vibrato: 0.04 })
      addNoise(out, 0, 0.05, random, { highpass: 2000, decay: 0.012, gain: 0.35 }); break
    case 'door-close':
      addTone(out, 0, 0.2, 95, { glideTo: 60, decay: 0.07, gain: 0.6 }); addNoise(out, 0, 0.12, random, { lowpass: 900, decay: 0.03, gain: 0.5 })
      addNoise(out, 0.06, 0.04, random, { highpass: 2500, decay: 0.01, gain: 0.25 }); break
    case 'transition': addNoise(out, 0, 0.5, random, { lowpass: 1800, highpass: 300, attack: 0.25, decay: 0.15, gain: 0.35 }); break
    case 'chair-sit': addNoise(out, 0, 0.15, random, { lowpass: 600, attack: 0.01, decay: 0.05, gain: 0.6 }); addTone(out, 0.05, 0.18, 240, { wave: 'soft-square', glideTo: 200, decay: 0.08, gain: 0.05 }); break
    case 'chair-stand': addTone(out, 0, 0.18, 200, { wave: 'soft-square', glideTo: 260, decay: 0.08, gain: 0.05 }); addNoise(out, 0.04, 0.1, random, { lowpass: 700, decay: 0.03, gain: 0.4 }); break
    case 'typing': for (let k = 0; k < 6; k++) addNoise(out, k * 0.085 + random() * 0.02, 0.04, random, { highpass: 1800, lowpass: 6000, decay: 0.008, gain: 0.5 }); break
    case 'marker': addNoise(out, 0, 0.35, random, { highpass: 2500, lowpass: 5000, attack: 0.02, decay: 0.2, gain: 0.2 }); addTone(out, 0, 0.3, 1900, { glideTo: 2200, decay: 0.15, gain: 0.04, vibrato: 0.03 }); break
    case 'kiosk': addTone(out, 0, 0.1, 880, { wave: 'soft-square', decay: 0.06, gain: 0.12 }); addTone(out, 0.1, 0.15, 1320, { wave: 'soft-square', decay: 0.08, gain: 0.12 }); break
    case 'leaves': for (let k = 0; k < 5; k++) addNoise(out, k * 0.07, 0.12, random, { highpass: 2200, lowpass: 7000, attack: 0.01, decay: 0.05, gain: 0.3 }); break
    case 'page': addNoise(out, 0, 0.25, random, { highpass: 1200, lowpass: 5000, attack: 0.05, decay: 0.08, gain: 0.4 }); break
    case 'click': addNoise(out, 0, 0.025, random, { highpass: 1500, decay: 0.006, gain: 0.6 }); addTone(out, 0, 0.03, 1800, { decay: 0.01, gain: 0.15 }); break
    case 'panel-open': addTone(out, 0, 0.12, 520, { wave: 'triangle', glideTo: 780, decay: 0.08, gain: 0.25 }); break
    case 'panel-close': addTone(out, 0, 0.12, 780, { wave: 'triangle', glideTo: 520, decay: 0.08, gain: 0.25 }); break
    case 'chat': addTone(out, 0, 0.12, mtof(88), { wave: 'bell', decay: 0.1, gain: 0.18 }); addTone(out, 0.09, 0.2, mtof(91), { wave: 'bell', decay: 0.15, gain: 0.18 }); break
    case 'success': [72, 76, 79, 84].forEach((n, k) => addTone(out, k * 0.07, 0.35, mtof(n), { wave: 'triangle', decay: 0.18, gain: 0.2 })); break
    case 'error': addTone(out, 0, 0.16, mtof(57), { wave: 'soft-square', decay: 0.1, gain: 0.12 }); addTone(out, 0.15, 0.25, mtof(53), { wave: 'soft-square', decay: 0.15, gain: 0.12 }); break
    case 'notify': addTone(out, 0, 0.6, 1175, { wave: 'bell', decay: 0.3, gain: 0.2 }); break
    case 'announce': [79, 76, 72].forEach((n, k) => addTone(out, k * 0.38, 1, mtof(n), { wave: 'bell', decay: 0.5, gain: 0.22 })); break
    case 'beep': addTone(out, 0, 0.09, 1046, { wave: 'soft-square', decay: 0.05, gain: 0.1 }); break
    case 'alarm': for (let k = 0; k < 4; k++) addTone(out, k * 0.26, 0.24, k % 2 ? 660 : 880, { wave: 'soft-square', attack: 0.02, decay: 0.2, gain: 0.08 }); break
    case 'sip': addNoise(out, 0, 0.3, random, { lowpass: 2400, highpass: 600, attack: 0.08, decay: 0.12, gain: 0.3 }); addTone(out, 0.22, 0.08, 500, { glideTo: 350, decay: 0.03, gain: 0.15 }); break
    case 'munch': for (let k = 0; k < 3; k++) addNoise(out, k * 0.13, 0.08, random, { lowpass: 3000, highpass: 300, decay: 0.025, gain: 0.5 }); break
    case 'splash': addNoise(out, 0, 0.45, random, { lowpass: 2600, highpass: 200, attack: 0.005, decay: 0.12, gain: 0.6 }); break
    case 'plop': addTone(out, 0, 0.12, 700, { glideTo: 220, decay: 0.05, gain: 0.4 }); break
    case 'cast': addNoise(out, 0, 0.3, random, { highpass: 1500, lowpass: 5000, attack: 0.12, decay: 0.08, gain: 0.25 }); break
  }
  roomReverb(out, key.startsWith('footstep') ? 0 : 0.25)
  return normalize(out, key.startsWith('footstep') ? 0.5 : 0.8)
}
