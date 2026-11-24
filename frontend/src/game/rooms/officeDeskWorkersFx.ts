import Npc from '../npc/Npc'
import { OFFICE_DESK_WORKERS } from './officeStaffData'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'

/**
 * 서비스 연구실 오른쪽 열 작업석 연구원 셋의 연출.
 * 의자에 앉아 묵묵히 일하다가, 가끔 한 명씩 화가 나서 한마디 내뱉는다(💢 표시와 함께 몸이 들썩인다).
 * E로 말을 걸면 일하면서 짧게 대답한다. 서버 상태를 조회하거나 업무를 기록하지 않는 화면 연출이다.
 *
 * @author 길태형
 * @version 1.0, 채용 업무 삭제 후 작업석 연구원을 일반 직원 연출로 전환
 * @see "None"
 */
export function officeDeskWorkersFx(ctx: Context): RoomHandlers {
  /* 작업석 연구원: 경로 한 점에 고정해 앉힌다. */
  const workers = OFFICE_DESK_WORKERS.map(def => new Npc(ctx.scene, def))
  let turn = Math.floor(Math.random() * workers.length)

  /* 화내는 이벤트: 12~20초마다 한 명씩 돌아가며 버럭(겹쳐 말하지 않게 한 번에 한 명). */
  ctx.every(12000, 20000, () => {
    workers[turn % workers.length]!.vent()
    turn++
  }, 7000)

  const update = (_time: number, delta: number) => { for (const worker of workers) worker.update(delta) }
  ctx.scene.events.on('update', update)
  return {
    targets: () => workers.map(worker => worker.target()),
    hint: target => target.id.startsWith('office-desk-') ? 'E · 일하는 연구원에게 말 걸기' : undefined,
    intercept: target => {
      const worker = workers.find(npc => npc.def.id === target.id)
      if (!worker) return false
      worker.talk(ctx.options.player?.())
      return true
    },
    destroy: () => { ctx.scene.events.off('update', update); for (const worker of workers) worker.destroy() },
  }
}
