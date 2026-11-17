import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { playSfx } from '../../audio/AudioManager'

/**
 * 관리자실: 월넛 벽과 버건디 카펫 위에 운영 DB 슈퍼컴퓨터가 한 대 있다.
 * 슈퍼컴퓨터 불빛이 깜박이고, 책상 스탠드 조명이 은은하게 숨 쉰다. E를 누르면 쿼리 콘솔이 열린다(관리자만 들어온다).
 */
export function adminRoomFx(ctx: Context): RoomHandlers {
  const { scene } = ctx
  // 따뜻한 스탠드 조명과 슈퍼컴퓨터 쪽 차가운 불빛
  const lamp = ctx.glow(400, 330, '#e7c66f', 16, 4, 0.12, -30)
  scene.tweens.add({ targets: lamp, alpha: 0.06, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  for (const x of [300, 400, 500]) {
    const led = ctx.glow(x, 160, '#c084fc', 4, 2.4, 0.25, 200)
    scene.tweens.add({ targets: led, alpha: 0.08, duration: 120, yoyo: true, repeat: -1, repeatDelay: 1800 + x * 3 })
  }
  // 문패
  ctx.text(400, 32, 'ADMINISTRATOR · PRODUCTION DB', 10, '#e7c66f', 62, true)
  const live = ctx.text(668, 32, '● LIVE', 10, '#ff7a7a', 62, true)
  scene.tweens.add({ targets: live, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 })
  const clock = ctx.text(140, 32, '', 10, '#e7c66f', 62, true)
  const pad = (value: number) => String(value).padStart(2, '0')
  const tick = () => { const now = new Date(); clock.setText(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`) }
  tick()
  scene.time.addEvent({ delay: 1000, loop: true, callback: tick })
  // 가끔 디스크가 도는 소리처럼 작은 알림음
  ctx.every(24000, 40000, () => playSfx('beep', { volume: 0.25 }))
  return { destroy: () => ctx.stop() }
}
