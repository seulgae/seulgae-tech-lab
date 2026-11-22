import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { AGENTS } from '../src/features/recruitment/recruitmentApi.ts'
import { roomSeats } from '../src/game/maps/rooms.ts'
import { isNearObject } from '../src/game/interaction.ts'
import { stepToward, pickLine } from '../src/game/npc/npcData.ts'

const npcSource = stripTypeScriptTypes(await readFile(new URL('../src/game/npc/Npc.ts', import.meta.url), 'utf8'))
  .replace(/^import .*$/gm, '').replace('export default class Npc', 'class Npc')
const Npc = vm.runInNewContext(npcSource + '\nNpc', { stepToward, pickLine, SpeechBubble: class { update() {} destroy() {} } })

test('채용 직원은 오른쪽 실제 의자에서 앉은 프레임을 유지하고 옆·뒤 통로에서 E 대상이 된다', () => {
  for (const agent of AGENTS) {
    const seat = roomSeats('office-1').find(s => s.x === agent.x && s.bottom === agent.y)
    assert.ok(seat, `${agent.name} 의자`)
    const sprite = { setOrigin() { return this }, setScale() { return this }, setDepth() { return this }, setTint() { return this }, setPosition() { return this }, setTexture(key) { this.key = key; return this } }
    const npc = new Npc({ add: { image(_x, _y, key) { sprite.key = key; return sprite } } }, { id: `recruitment-${agent.id}`, name: agent.name, kind: agent.kind, seated: true, fixed: true, idle: true, path: [{ x: agent.x, y: agent.y }], speed: 0, pause: [600000, 600000], talk: [] })
    assert.match(sprite.key, /-seated-0$/)
    npc.setWorkState('WORKING'); npc.update(300)
    assert.match(sprite.key, /-seated-1$/)
    const target = npc.target()
    assert.equal(isNearObject(seat.x + 50, seat.y, target, target.range), true, '오른쪽 통로에서 접근')
    assert.equal(isNearObject(seat.x, seat.y + 45, target, target.range), true, '의자 뒤에서 직원 우선 상호작용')
    assert.equal(isNearObject(400, 300, target, target.range), false, '먼 곳에서는 열지 않음')
    assert.equal(target.kind, 'npc')
  }
})
