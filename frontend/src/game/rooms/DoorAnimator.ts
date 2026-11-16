import Phaser from 'phaser'
import { ROOMS } from '../maps/rooms'
import type { RoomId } from '../maps/rooms'
import { ROOM_THEMES } from './roomThemes'
import { crispText } from '../render/renderScale'

/** 문이 열리는 데 걸리는 시간. 서버 승인이 먼저 와도 이 시간만큼은 열림을 보여 준다. */
export const DOOR_OPEN_MS = 280
const DOOR_CLOSE_MS = 320

type Door = { left: Phaser.GameObjects.Image; right: Phaser.GameObjects.Image; light: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Image }
const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color

/**
 * 출입구마다 문틀과 좌·우 문짝을 만들고 여닫이 애니메이션을 재생한다.
 * 문짝은 경첩 쪽을 기준으로 가로 배율을 줄여 안쪽으로 열리는 것처럼 보인다.
 * 문 너머에는 목적지 방의 조명 색이 비친다.
 *
 * @author seulgae
 * @version 1.0, 방 이동 문 열림·닫힘 연출
 * @see "None"
 */
export default class DoorAnimator {
  private readonly scene: Phaser.Scene
  private readonly doors = new Map<string, Door>()
  private openUntil = 0

  constructor(scene: Phaser.Scene, roomId: RoomId) {
    this.scene = scene
    for (const door of ROOMS[roomId].doors) {
      const target = door.target as RoomId
      // 문은 아래쪽 벽에 붙어 있으므로 캐릭터가 항상 문 앞에 그려지도록 낮은 깊이를 쓴다.
      const depth = 4
      scene.add.ellipse(door.x, door.y + 4, 90, 12, 0x000000, 0.25).setDepth(depth - 2)
      scene.add.image(door.x, door.y, `door-frame-${roomId}`).setOrigin(0.5, 1).setScale(2).setDepth(depth - 1)
      // 개구부(문틀 x 6~41, y 6~39)를 목적지 조명으로 채운다. 닫혀 있을 땐 문짝이 가린다.
      const light = scene.add.rectangle(door.x, door.y - 34, 72, 68, hex(ROOM_THEMES[target].light), 0).setDepth(depth)
      const glow = scene.add.image(door.x, door.y - 20, 'glow').setTint(hex(ROOM_THEMES[target].light)).setScale(4, 2.5)
        .setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 3)
      const left = scene.add.image(door.x - 36, door.y, `door-panel-${roomId}`).setOrigin(0, 1).setScale(2).setDepth(depth + 1)
      const right = scene.add.image(door.x + 36, door.y, `door-panel-${roomId}`).setOrigin(1, 1).setScale(2).setFlipX(true).setDepth(depth + 1)
      crispText(scene, door.x, door.y + 16, ROOMS[target].name, {
        fontSize: '12px', fontStyle: 'bold', color: '#fff7e6', backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setOrigin(0.5).setDepth(depth + 4)
      this.doors.set(door.id, { left, right, light, glow })
    }
  }

  /** 서버에 이동을 요청할 때 바로 문을 연다. */
  open(doorId: string) {
    const door = this.doors.get(doorId)
    if (!door) return
    this.openUntil = this.scene.time.now + DOOR_OPEN_MS
    this.tween(door, 0.28, 0.85, DOOR_OPEN_MS, 'Cubic.easeOut')
  }

  /** 이동이 거부되면 다시 닫는다. */
  close(doorId: string) {
    const door = this.doors.get(doorId)
    if (door) this.tween(door, 2, 0, DOOR_CLOSE_MS, 'Back.easeOut')
  }

  /** 도착한 방에서는 지나온 문이 열린 상태로 시작해 잠시 뒤 닫힌다. */
  arriveThrough(doorId: string | undefined) {
    const door = doorId ? this.doors.get(doorId) : undefined
    if (!door) return
    door.left.scaleX = door.right.scaleX = 0.28
    door.light.setAlpha(0.85); door.glow.setAlpha(0.85)
    this.scene.time.delayedCall(220, () => this.tween(door, 2, 0, DOOR_CLOSE_MS, 'Back.easeOut'))
  }

  /** 열림 연출이 끝나기까지 남은 시간(ms) */
  remainingOpenMs() { return Math.max(0, this.openUntil - this.scene.time.now) }

  private tween(door: Door, scaleX: number, alpha: number, duration: number, ease: string) {
    this.scene.tweens.killTweensOf([door.left, door.right, door.light, door.glow])
    this.scene.tweens.add({ targets: [door.left, door.right], scaleX, duration, ease })
    this.scene.tweens.add({ targets: [door.light, door.glow], alpha, duration, ease: 'Sine.easeOut' })
  }
}
