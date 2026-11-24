import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFICE_STAFF, OFFICE_DESK, OFFICE_STAND, OFFICE_DESK_WORKERS, officeDeskPhase } from '../src/game/rooms/officeStaffData.ts'
import { RESEARCHER_STYLES } from '../src/game/npc/npcData.ts'
import { roomObstacles, roomObjects } from '../src/game/maps/rooms.ts'

const obstacles = roomObstacles('office-1')
const blocked = (x, y) => obstacles.some(o => Math.abs(x-o.x) < o.width/2+8 && Math.abs(y-o.y) < o.height/2+8)

test('돌아다니는 연구원은 책상·파티션·벽을 통과하지 않고 8px 발밑 여유를 둔다', () => {
  for (const staff of OFFICE_STAFF) for (let i=0; i<staff.path.length; i++) {
    const a=staff.path[i], b=staff.path[(i+1)%staff.path.length], steps=Math.max(1, Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/4))
    for (let n=0;n<=steps;n++) assert.equal(blocked(a.x+(b.x-a.x)*n/steps,a.y+(b.y-a.y)*n/steps),false,staff.id)
  }
  assert.equal(blocked(OFFICE_STAND.x,OFFICE_STAND.y),false,'일어난 자리도 가구 바깥')
  assert.ok(roomObjects('office-1').some(o=>o.texture==='chair'&&o.x===OFFICE_DESK.x&&o.bottom===OFFICE_DESK.y))
})

test('작업석 연구원은 24초 앉아 일하고 8초 일어났다가 다음 주기에 복귀한다', () => {
  for (const base of [0,32000,64000]) {
    assert.equal(officeDeskPhase(base),'seated');assert.equal(officeDeskPhase(base+23999),'seated')
    assert.equal(officeDeskPhase(base+24000),'standing');assert.equal(officeDeskPhase(base+31999),'standing')
    assert.equal(officeDeskPhase(base+32000),'seated')
  }
})

test('사무실 여섯 인물은 모두 서로 다른 외형의 연구원이다', () => {
  const kinds=[...OFFICE_DESK_WORKERS.map(a=>a.kind),...OFFICE_STAFF.map(a=>a.kind),'researcher-curly']
  assert.equal(new Set(kinds).size,6)
  for (const kind of kinds) assert.ok(RESEARCHER_STYLES.some(s=>s.kind===kind),kind)
  const desks=roomObjects('office-1').filter(o=>o.texture==='computer')
  assert.deepEqual([...new Set(desks.map(o=>o.x))],[190,610])
  assert.deepEqual(desks.slice(0,3).map(o=>o.body.y),[150,300,450])
  assert.deepEqual(desks.slice(3).map(o=>o.body.y),[150,300,450])
})

test('작업석 연구원 넷(오른쪽 셋, 왼쪽 가운데 QA 자리)은 앉아서 일하다가 가끔 화가 나서 한마디 한다', () => {
  assert.equal(OFFICE_DESK_WORKERS.length, 4)
  for (const worker of OFFICE_DESK_WORKERS) {
    assert.equal(worker.seated, true, worker.id)
    assert.ok(worker.angry.length >= 5 && worker.talk.length >= 2, worker.id)
    assert.ok(worker.angry.every(line => /[!?…]/.test(line)), '화난 말투')
    assert.ok(roomObjects('office-1').some(o => o.texture === 'chair' && o.x === worker.path[0].x && o.bottom === worker.path[0].y), `${worker.id} 의자`)
  }
  assert.ok(OFFICE_DESK_WORKERS.every(worker => !worker.id.startsWith('recruitment-')))
})
