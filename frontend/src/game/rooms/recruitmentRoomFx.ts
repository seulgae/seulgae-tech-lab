import Npc from '../npc/Npc'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { AGENTS } from '../../features/recruitment/recruitmentApi'

/**
 * 오른쪽 작업석에 가운 연구원 셋을 배치하고 E로 역할별 채용 화면을 연다.
 * 사무실 장식은 서버 상태를 요청하지 않으며 담당 이름과 역할만 표시한다.
 * @author seulgae
 * @version 1.2, 사무실 이름표와 실제 채용 상태 조회 분리
 * @see "None"
 */
export function recruitmentRoomFx(ctx: Context): RoomHandlers {
  const names = { SEARCH: '접수', CHECK: '검토', REGISTER: '지원 관리' }
  const employees = AGENTS.map(agent => {
    const npc = new Npc(ctx.scene, { id: `recruitment-${agent.id}`, kind: agent.kind, name: agent.name,
      path: [{ x: agent.x, y: agent.y }], fixed: true, seated: true, idle: true, speed: 0, pause: [600000, 600000], talk: [agent.role] })
    const label = ctx.text(710, agent.y - 19, `${agent.name} · ${names[agent.id]}`, 10, '#e2eef4', 600)
    label.setBackgroundColor('#283e49').setPadding(4, 2)
    return { agent, npc, label }
  })
  const update = (_time: number, delta: number) => { for (const e of employees) e.npc.update(delta) }
  ctx.scene.events.on('update', update)
  return {
    targets: () => employees.map(e => e.npc.target()),
    hint: target => target.id.startsWith('recruitment-') ? 'E · 담당 공고 보기' : undefined,
    intercept: target => { const employee = employees.find(e => e.npc.def.id === target.id); if (!employee) return false; ctx.options.openRecruitment?.(employee.agent.id); return true },
    destroy: () => { ctx.scene.events.off('update', update); for (const e of employees) { e.npc.destroy(); e.label.destroy() } },
  }
}
