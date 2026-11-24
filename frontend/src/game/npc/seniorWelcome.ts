import Npc from './Npc'
import type { NpcDef } from './npcData'
import type { Context } from '../rooms/fxContext'
import { authStore } from '../../features/auth/authStore'
import { playSfx } from '../../audio/AudioManager'

const WELCOME_KEY = 'seulgae.lab.senior-welcome.v1'
const DOOR_GREETING_SPOT = { x: 451, y: 455 }
const SENIOR: NpcDef = {
  id: 'npc-senior-welcome', kind: 'researcher-silver', name: '선임 연구원',
  path: [{ x: 540, y: 397 }, DOOR_GREETING_SPOT], speed: 125, pause: [600_000, 600_000],
  talk: [], fixed: true, facesRight: false,
}
let welcomed = false

/** 선임 연구원이 로비 입구로 걸어 나와 신입에게 자리와 메일함을 안내한다. */
export function seniorWelcome(ctx: Context) {
  if (welcomed) return
  try {
    if (globalThis.localStorage.getItem(WELCOME_KEY) === 'seen') return
  } catch { /* 저장소가 제한된 곳에서는 이번 실행 동안만 재생 여부를 기억한다. */ }

  const npc = new Npc(ctx.scene, SENIOR)
  let spoke = false

  const greet = () => {
    spoke = true
    welcomed = true
    try { globalThis.localStorage.setItem(WELCOME_KEY, 'seen') } catch { /* 메모리에 재생 여부를 기록했다. */ }
    const nickname = authStore.get().member?.nickname ?? '신입 연구원'
    npc.say(`어서 와, ${nickname}! 오늘 온다고 들었어.\n개발 연구실 안의 서비스 연구실로 가서 네 자리에 앉아 메일함을 확인해 봐.`, 9500)
    playSfx('chat', { volume: 0.5 })
  }

  const tick = (_time: number, delta: number) => {
    npc.update(delta)
    if (!spoke && npc.position.x === DOOR_GREETING_SPOT.x && npc.position.y === DOOR_GREETING_SPOT.y) greet()
  }
  ctx.scene.events.on('update', tick)

  return {
    target: () => npc.target(),
    greet,
    destroy: () => { ctx.scene.events.off('update', tick); npc.destroy() },
  }
}
