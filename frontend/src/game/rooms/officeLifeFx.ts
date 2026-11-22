import Npc from '../npc/Npc'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { OFFICE_DESK, OFFICE_STAFF, OFFICE_STAND, officeDeskPhase } from './officeStaffData'

/**
 * 통로를 돌아다니는 직원 둘과 작업·한숨·복귀를 반복하는 연구원을 그린다.
 * @author seulgae
 * @version 1.0, 사무실 생활 NPC와 순환 대사
 * @see "None"
 */
export function officeLifeFx(ctx: Context): RoomHandlers {
  const walkers = OFFICE_STAFF.map(def => new Npc(ctx.scene, def))
  const worker = new Npc(ctx.scene, { id: 'office-desk-worker', name: '막힌 연구원', kind: 'researcher-curly',
    path: [OFFICE_DESK], fixed: true, seated: true, idle: true, speed: 0, pause: [600000, 600000],
    talk: ['이거 왜 안 되는지 아세요?', '일단 다시 해볼게요…', '커피 마시면 생각나려나.'] })
  const employees = [...walkers, worker]
  // 직원 의자에서는 QA 게시판을 열어 플레이어와 직원이 겹쳐 앉지 않게 한다.
  const deskTarget = { ...worker.target(), id: 'service-qa', kind: 'work-board' as const, label: 'QA 게시판' }
  let elapsed = 0, phase = officeDeskPhase(0), speaking = 0
  // 한 번에 한 직원이 중얼거려 이름표와 공고 담당자를 가리지 않게 한다.
  ctx.every(9000, 14000, () => { walkers[speaking % walkers.length]!.talk(); speaking++ }, 6500)
  const update = (_time: number, delta: number) => {
    elapsed += delta
    const next = officeDeskPhase(elapsed)
    if (next !== phase) {
      phase = next; worker.setSeated(next === 'seated', next === 'seated' ? OFFICE_DESK : OFFICE_STAND)
      worker.say(next === 'standing' ? '아 모르겠다 샤갈.' : '…다시 해보자.', next === 'standing' ? 4200 : 2000)
    }
    for (const npc of employees) npc.update(delta)
  }
  ctx.scene.events.on('update', update)
  return {
    targets: () => [...walkers.map(npc => npc.target()), deskTarget, ...(phase === 'standing' ? [worker.target()] : [])],
    hint: target => target.id.startsWith('office-') ? 'E · 연구원에게 말 걸기' : undefined,
    intercept: target => { const npc = employees.find(e => e.def.id === target.id); if (!npc) return false; npc.talk(ctx.options.player?.()); return true },
    destroy: () => { ctx.scene.events.off('update', update); for (const npc of employees) npc.destroy() },
  }
}
