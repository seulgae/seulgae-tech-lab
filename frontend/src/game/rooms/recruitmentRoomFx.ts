import Npc from '../npc/Npc'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { AGENTS, STATE, request } from '../../features/recruitment/recruitmentApi'
import type { Job } from '../../features/recruitment/recruitmentApi'

/**
 * 서비스 연구실 오른쪽 열 책상 옆에 업무 직원 셋(서치·체크·로그)을 세우고 실제 서버 상태를 표시한다.
 * @author seulgae
 * @version 1.0, 채용 직원과 실제 업무 상태 연결
 * @see "None"
 */
/** 상태 이름표: 오른쪽 벽 가까이 서 있어 글이 길어지면 화면(800px) 안으로 밀어 넣는다. */
function setLabel(label: Phaser.GameObjects.Text, x: number, text: string) {
  label.setText(text)
  label.setX(Math.min(x, 794 - label.displayWidth / 2))
}

export function recruitmentRoomFx(ctx: Context): RoomHandlers {
  let stopped = false
  let controller: AbortController | undefined
  const employees = AGENTS.map(agent => {
    const npc = new Npc(ctx.scene, { id: `recruitment-${agent.id}`, kind: agent.kind, name: agent.name,
      path: [{ x: agent.x, y: agent.y }], fixed: true, idle: true, speed: 0, pause: [600000, 600000], talk: [agent.role] })
    npc.onClick(() => ctx.options.openRecruitment?.(agent.id))
    const label = ctx.text(agent.x, agent.y + 17, `${agent.name} · 조회 중`, 11, '#fff4cc', 600)
    label.setBackgroundColor('#182434').setPadding(4, 2)
    return { agent, npc, label }
  })
  /** 폴링은 상태 표시만 담당한다. 브라우저에서 업무를 실행하지 않는다. */
  const load = async () => {
    controller?.abort(); controller = new AbortController()
    try {
      const status = await request<{ enabled: boolean; jobs: Job[] }>('/agents', 'GET', undefined, controller.signal)
      if (stopped) return
      for (const { agent, npc, label } of employees) {
        const candidates = status.jobs.filter(j => j.task === agent.id || (agent.id === 'REGISTER' && j.task === 'REPORT'))
        const state = candidates.find(j => j.state === 'WORKING')?.state ?? candidates.find(j => j.state === 'FAILED' || j.state === 'UNAVAILABLE')?.state ?? candidates.at(-1)?.state ?? (status.enabled ? 'WAITING' : 'UNAVAILABLE')
        npc.setWorkState(state); setLabel(label, agent.x, `${agent.name} · ${STATE[state] ?? state}`)
      }
    } catch { if (!stopped) for (const { agent, npc, label } of employees) { npc.setWorkState('UNKNOWN'); setLabel(label, agent.x, `${agent.name} · 상태 조회 실패`) } }
  }
  void load()
  ctx.every(10000, 10000, () => { void load() })
  const update = (_time: number, delta: number) => { for (const e of employees) e.npc.update(delta) }
  ctx.scene.events.on('update', update)
  return {
    targets: () => employees.map(e => e.npc.target()),
    hint: target => target.id.startsWith('recruitment-') ? 'E · 업무 현황 보기' : undefined,
    intercept: target => { const employee = employees.find(e => e.npc.def.id === target.id); if (!employee) return false; ctx.options.openRecruitment?.(employee.agent.id); return true },
    destroy: () => { stopped = true; controller?.abort(); ctx.stop(); ctx.scene.events.off('update', update); for (const e of employees) { e.npc.destroy(); e.label.destroy() } },
  }
}
