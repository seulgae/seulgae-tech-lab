import type { RoomId } from '../game/maps/rooms.ts'
import { floorData } from '../game/rooms/roomThemes.ts'
import type { SkyPhase } from '../game/rooms/timeOfDay.ts'
import type { AmbienceKey, EffectKey } from './synth.ts'

/**
 * 사운드 규칙(방별 음악·환경음, 발걸음, 거리 감쇠). Phaser에 의존하지 않아 node 테스트로 검증한다.
 */
export type Soundscape = { bgm: RoomId; ambience: AmbienceKey; ambienceGain: number }
const NIGHT: SkyPhase[] = ['dawn', 'evening']

/** 방마다 배경음악과 환경음. 바깥은 밤(새벽·저녁)이면 귀뚜라미 환경음으로 바뀐다. */
export function roomSoundscape(roomId: RoomId, phase: SkyPhase): Soundscape {
  switch (roomId) {
    case 'development-lab': return { bgm: roomId, ambience: 'keyboard', ambienceGain: 0.8 }
    case 'server-room': return { bgm: roomId, ambience: 'server-fan', ambienceGain: 1 }
    case 'meeting-room': return { bgm: roomId, ambience: 'clock', ambienceGain: 0.6 }
    case 'control-room': return { bgm: roomId, ambience: 'electronics', ambienceGain: 0.9 }
    case 'outdoor': return { bgm: roomId, ambience: NIGHT.includes(phase) ? 'meadow-night' : 'meadow-day', ambienceGain: 1 }
    // 개인 사무실은 개발 연구실 음악을 이어 듣는다. 지저분한 사무실만 타자 소리가 난다.
    case 'office-1': case 'office-2': case 'office-4': return { bgm: 'development-lab', ambience: 'room-tone', ambienceGain: 0.35 }
    // 3번 오락실: 오락기 전자음
    case 'office-3': return { bgm: 'control-room', ambience: 'electronics', ambienceGain: 1 }
    default: return { bgm: 'lobby', ambience: 'room-tone', ambienceGain: 0.45 }
  }
}

/** 발 밑 바닥 재질에 맞는 발걸음 소리. 카펫(로비 레드 카펫·회의실), 풀·나무 판(다리·데크), 나머지는 딱딱한 바닥 */
export function footstepSound(roomId: RoomId, x: number, y: number): EffectKey {
  if (roomId === 'outdoor') {
    const onBridge = x >= 626 && x <= 714 && y >= 322 && y <= 390
    const onDock = x >= 592 && x <= 644 && y >= 448 && y <= 494
    if (onBridge || onDock) return 'footstep-wood'
  }
  const row = Math.min(18, Math.max(0, Math.floor(y / 32))), column = Math.min(24, Math.max(0, Math.floor(x / 32)))
  const tile = floorData(roomId)[row]![column]!
  if (roomId === 'outdoor') return tile === 2 ? 'footstep' : 'footstep-grass'
  if ((roomId === 'lobby' || roomId === 'meeting-room') && tile === 2) return 'footstep-carpet'
  return 'footstep'
}

/**
 * 실제로 움직인 거리만큼 발걸음을 센다. 방향키를 눌러도 벽·가구에 막혀 좌표가 그대로면 소리가 없고,
 * 멈추면 쌓인 거리를 버려 멈춘 뒤 한 발이 더 나지 않는다. 순간이동(서버 보정·방 이동)은 무시한다.
 *
 * 멈춤은 좌표가 STOP_MS 동안 그대로일 때만 본다. 화면이 90·120Hz인 휴대폰은 물리(초당 60번)보다 화면을 자주 그려
 * 걷는 중에도 좌표가 그대로인 프레임이 끼는데, 그 한 프레임을 멈춤으로 보면 매 프레임 첫 발이 나서 소리가 연사된다.
 */
export class FootstepTracker {
  static readonly STOP_MS = 120
  private last?: { x: number; y: number }
  private travelled = 0
  private moving = false
  private idle = 0
  private readonly stride: number
  private readonly teleport: number
  constructor(stride = 24, teleport = 48) { this.stride = stride; this.teleport = teleport }

  /**
   * @param delta 지난 갱신 뒤 흐른 시간(ms). 화면 주사율과 상관없이 멈춤을 시간으로 판단한다.
   * @returns 이번 갱신에서 발걸음 소리를 낼지
   */
  update(x: number, y: number, delta = 1000 / 60): boolean {
    const last = this.last
    this.last = { x, y }
    if (!last) return false
    const distance = Math.hypot(x - last.x, y - last.y)
    if (distance > this.teleport) { this.stop(); return false }
    if (distance < 0.05) {
      this.idle += delta
      if (this.idle >= FootstepTracker.STOP_MS) this.stop()
      return false
    }
    this.idle = 0
    // 첫 발은 움직이기 시작하자마자 낸다.
    if (!this.moving) { this.moving = true; this.travelled = 0; return true }
    this.travelled += distance
    if (this.travelled < this.stride) return false
    this.travelled -= this.stride
    return true
  }

  private stop() { this.moving = false; this.travelled = 0; this.idle = 0 }

  reset() { this.last = undefined; this.stop() }
}

/** 다른 연구원 소리의 거리 감쇠: 가까우면 작게(최대 0.6), 멀수록 작아지고 maxDistance 밖은 0 */
export function spatialVolume(dx: number, dy: number, maxDistance = 320) {
  const distance = Math.hypot(dx, dy)
  if (distance >= maxDistance) return 0
  const near = 1 - distance / maxDistance
  return Math.round(0.6 * near * near * 1000) / 1000
}

/** 왼쪽·오른쪽 소리 위치(-1~1). 화면 가로 800 기준 */
export const spatialPan = (dx: number) => Math.max(-1, Math.min(1, dx / 400))
