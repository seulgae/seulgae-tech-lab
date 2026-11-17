import Phaser from 'phaser'
import { ROOMS, roomObjects } from '../maps/rooms'
import { MONITOR_SCREENS } from '../assets/roomAssets'
import type { RoomFeeds } from '../../features/multiplayer/model/protocol'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { CCTV_ROOMS, feedPoint } from './cctvLayout'
import { playSfx } from '../../audio/AudioManager'

/** 모니터 월 텍스처는 중심 x 400, 바닥 y 168에 2배로 그려진다(왼쪽 위 120, 40). */
const WALL_LEFT = 120
const WALL_TOP = 40
const SCREEN_DEPTH = 170
const AMBER = 0xffb547
const GREEN = 0x4ade80

/**
 * 관제실: 벽 모니터 6대에 각 방의 평면도와 연구원 위치를 실시간(약 5Hz)으로 그린다.
 * 서버는 관제실에 있는 참가자에게만 방별 목록(feeds)을 보낸다. 콘솔에서 E를 누르면 React 관제 패널이 열린다.
 */
export function controlRoomFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  // 모니터 빛이 바닥에 번지는 초록·앰버 조명
  ctx.glow(400, 210, '#4ade80', 18, 4, 0.12, -30)
  const consoleGlow = ctx.glow(400, 270, '#ffb547', 9, 3, 0.18, -30)
  scene.tweens.add({ targets: consoleGlow, alpha: 0.08, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.18).setDepth(-20)

  const screens = CCTV_ROOMS.slice(0, MONITOR_SCREENS.length).map((roomId, index) => {
    const s = MONITOR_SCREENS[index]!
    const x = WALL_LEFT + s.x * 2, y = WALL_TOP + s.y * 2, height = s.height * 2
    // 왼쪽은 4:3 평면도, 오른쪽은 방 이름과 인원
    const map = { x: x + 3, y: y + 3, width: Math.round((height - 6) * 4 / 3), height: height - 6 }
    const floor = scene.add.graphics().setDepth(SCREEN_DEPTH)
    floor.fillStyle(0x0f2a1c, 1).fillRect(map.x, map.y, map.width, map.height)
    floor.lineStyle(1, 0x2f6b46, 1).strokeRect(map.x + 0.5, map.y + 0.5, map.width - 1, map.height - 1)
    floor.fillStyle(0x1f4d33, 1)
    for (const object of roomObjects(roomId)) {
      const a = feedPoint(map, object.body.x - object.body.width / 2, object.body.y - object.body.height / 2)
      const b = feedPoint(map, object.body.x + object.body.width / 2, object.body.y + object.body.height / 2)
      floor.fillRect(a.x, a.y, Math.max(1, b.x - a.x), Math.max(1, b.y - a.y))
    }
    const dots = scene.add.graphics().setDepth(SCREEN_DEPTH + 1)
    ctx.text(map.x + map.width + 4, y + 10, ROOMS[roomId].name, 10, '#9ff5c0', SCREEN_DEPTH + 1).setOrigin(0, 0.5)
    const count = ctx.text(map.x + map.width + 4, y + 26, '0명', 12, '#ffd38a', SCREEN_DEPTH + 1, true).setOrigin(0, 0.5)
    const camera = ctx.text(map.x + map.width + 4, y + 41, `CAM-0${index + 1}`, 8, '#4f8f68', SCREEN_DEPTH + 1, true).setOrigin(0, 0.5)
    return { roomId, map, dots, count, camera }
  })
  // 화면 전체에 지나가는 주사선과 REC 표시
  const scan = scene.add.rectangle(400, WALL_TOP + 8, 548, 2, 0x9ff5c0, 0.18).setDepth(SCREEN_DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD)
  scene.tweens.add({ targets: scan, y: WALL_TOP + 120, duration: 2600, repeat: -1 })
  const rec = ctx.text(668, 32, '● REC', 10, '#ff5d5d', 62, true)
  scene.tweens.add({ targets: rec, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 })
  const clock = ctx.text(140, 32, '', 10, '#9ff5c0', 62, true)
  const pad = (value: number) => String(value).padStart(2, '0')
  const tick = () => { const now = new Date(); clock.setText(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`) }
  tick()
  scene.time.addEvent({ delay: 1000, loop: true, callback: tick })

  // 콘솔 버튼 깜빡임
  const buttons = Array.from({ length: 6 }, (_, i) => scene.add.rectangle(318 + i * 33, 300, 4, 4, i % 2 ? GREEN : AMBER).setDepth(315))
  scene.time.addEvent({ delay: 400, loop: true, callback: () => { for (const b of buttons) if (Math.random() < 0.3) b.setAlpha(b.alpha > 0.5 ? 0.25 : 1) } })

  // 모니터링 시스템: 가끔 상태 점검 알림음이 작게 난다.
  ctx.every(20000, 34000, () => playSfx('beep', { volume: 0.3 }))
  let selfId: string | null = null
  const draw = (feeds: RoomFeeds | null) => {
    for (const screen of screens) {
      const players = feeds?.[screen.roomId] ?? []
      screen.dots.clear()
      for (const player of players) {
        const point = feedPoint(screen.map, player.x, player.y)
        screen.dots.fillStyle(player.id === selfId ? AMBER : 0x5eead4, 1).fillRect(point.x - 2, point.y - 2, 4, 4)
      }
      screen.count.setText(feeds ? `${players.length}명` : '--').setColor(players.length ? '#ffd38a' : '#5f7d6c')
      screen.camera.setColor(feeds ? '#4f8f68' : '#7a3b3b')
    }
  }
  draw(ctx.options.client.latestFeeds())
  const unsubscribe = ctx.options.client.subscribe({
    snapshot: (_players, id) => { selfId = id },
    feeds: feeds => draw(feeds),
  })
  // 신호가 오지 않으면(연결 끊김) 화면을 어둡게 한다.
  const noise = scene.add.rectangle(400, WALL_TOP + 64, 556, 120, 0x000000, 0).setDepth(SCREEN_DEPTH + 3)
  scene.time.addEvent({ delay: 2000, loop: true, callback: () => noise.setFillStyle(0x000000, ctx.options.client.latestFeeds() ? 0 : 0.45) })
  return { destroy: () => { ctx.stop(); unsubscribe() } }
}
