import Npc from '../npc/Npc'
import { SERVER_ROBOTS } from '../npc/npcData'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'

/**
 * 서버실 관리 로봇 다섯. 랙 사이 통로를 순찰하며 온도·팬·백업·로그·보안 점검 말을 중얼거린다.
 * E로 말을 걸면 한마디 하고, 서버 용량 조사(MINA SSHD)를 어떻게 만들었는지 블로그 글로 안내하는 창을 연다.
 *
 * @author seulgae
 * @version 1.0, 서버실 관리 로봇
 * @see "None"
 */
export function serverRobotsFx(ctx: Context): RoomHandlers {
  const robots = SERVER_ROBOTS.map(def => new Npc(ctx.scene, def))
  const update = (_time: number, delta: number) => { for (const robot of robots) robot.update(delta) }
  ctx.scene.events.on('update', update)
  return {
    targets: () => robots.map(robot => robot.target()),
    hint: target => target.id.startsWith('server-robot-') ? 'E · 로봇에게 서버 점검 이야기 듣기' : undefined,
    intercept: target => {
      const robot = robots.find(npc => npc.def.id === target.id)
      if (!robot) return false
      robot.talk(ctx.options.player?.())
      ctx.options.openPanel?.('server-blog')
      return true
    },
    destroy: () => { ctx.scene.events.off('update', update); for (const robot of robots) robot.destroy() },
  }
}
