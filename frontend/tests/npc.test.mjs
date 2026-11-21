import assert from 'node:assert/strict'
import test from 'node:test'
import { CART_OPEN_HOUR, CART_SPOT, DEV_LAB_NPCS, LOBBY_NPCS, OUTDOOR_NPCS, cartOpenAt, pickLine, stepToward } from '../src/game/npc/npcData.ts'
import { roomObstacles } from '../src/game/maps/rooms.ts'
import { FISH_PRICE_MAX, fishPrice } from '../src/features/inventory/fishPrices.ts'

/** 경로 선분 위를 4px 간격으로 걸으며, 발밑이 장애물(8px 여유)에 들어가는지 본다. */
function blockedOnPath(room, path) {
  const obstacles = roomObstacles(room)
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length]
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4)
    for (let s = 0; s <= steps; s++) {
      const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps
      const hit = obstacles.find(o => Math.abs(x - o.x) < o.width / 2 + 8 && Math.abs(y - o.y) < o.height / 2 + 8)
      if (hit) return { x, y, hit }
    }
  }
  return null
}

test('NPC 경로는 호수·강·나무·가구를 지나지 않는다', () => {
  for (const npc of OUTDOOR_NPCS) assert.equal(blockedOnPath('outdoor', npc.path), null, npc.id)
  for (const npc of LOBBY_NPCS) assert.equal(blockedOnPath('lobby', npc.path), null, npc.id)
  for (const npc of DEV_LAB_NPCS) assert.equal(blockedOnPath('development-lab', npc.path), null, npc.id)
  const professor = DEV_LAB_NPCS[0]
  assert.equal(professor.kind, 'professor')
  assert.ok(professor.reactions.fail.length >= 2 && professor.reactions.pass.length >= 2, '빌드 실패에 놀라고 성공에 웃는다')
  assert.ok(professor.mutter.length >= 3, '연구 이야기를 중얼거린다')
  assert.deepEqual(OUTDOOR_NPCS.map(npc => npc.kind), ['woman', 'man', 'elder', 'kid-boy', 'kid-girl', 'fisher'])
  assert.equal(LOBBY_NPCS[0].kind, 'cleaner')
  assert.ok(LOBBY_NPCS[0].mutter.length >= 3, '아주머니는 혼자 궁시렁거린다')
  for (const npc of [...OUTDOOR_NPCS, ...LOBBY_NPCS]) assert.ok(npc.talk.length >= 3, npc.id)
})

test('말은 바로 반복하지 않고, 걸음은 프레임 시간만큼만 나아간다', () => {
  const lines = ['가', '나', '다']
  for (let r = 0; r < 1; r += 0.1) assert.notEqual(pickLine(lines, '나', () => r), '나')
  assert.equal(pickLine(['혼자'], '혼자'), '혼자')
  const half = stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, 1000)
  assert.deepEqual(half, { x: 50, y: 0, arrived: false })
  assert.deepEqual(stepToward({ x: 90, y: 0 }, { x: 100, y: 0 }, 50, 1000), { x: 100, y: 0, arrived: true })
})

test('포장마차는 저녁 6시부터 자정 전까지, 연구소 건물과 강을 피한 자리에 선다', () => {
  assert.equal(CART_OPEN_HOUR, 18)
  assert.equal(cartOpenAt(new Date(2026, 10, 21, 17, 59)), false)
  assert.equal(cartOpenAt(new Date(2026, 10, 21, 18, 0)), true)
  assert.equal(cartOpenAt(new Date(2026, 10, 21, 23, 59)), true)
  assert.equal(cartOpenAt(new Date(2026, 10, 22, 0, 0)), false)
  assert.ok(CART_SPOT.x + 48 < 640, '강(640~)보다 왼쪽')
  assert.ok(CART_SPOT.bottom < 548, '연구소 외벽(548~)보다 위')
})

test('물고기 값은 서버와 같은 규칙: 어종·크기에 비례, 1~30원', () => {
  assert.equal(fishPrice('붕어', 15), 2)
  assert.equal(fishPrice('붕어', 32), 6)
  assert.equal(fishPrice('붕어', 24), 4)
  assert.equal(fishPrice('피라미', 8), 1)
  assert.equal(fishPrice('메기', 65), 14)
  assert.equal(fishPrice('황금 잉어', 90), 30)
  assert.equal(fishPrice('황금 잉어', 999), FISH_PRICE_MAX)
  assert.equal(fishPrice('고래', 300), 0)
  assert.equal(fishPrice('붕어', null), 0)
})

test('포장마차 자리는 NPC가 지나가지 않고, 낚시꾼은 데크 낚시 자리를 가리지 않는다', () => {
  const cart = { x: CART_SPOT.x, y: CART_SPOT.bottom - 40, width: 96, height: 80 }
  for (const npc of OUTDOOR_NPCS) {
    for (let i = 0; i < npc.path.length; i++) {
      const a = npc.path[i], b = npc.path[(i + 1) % npc.path.length]
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4))
      for (let s = 0; s <= steps; s++) {
        const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps
        assert.ok(!(Math.abs(x - cart.x) < cart.width / 2 && Math.abs(y - cart.y) < cart.height / 2), `${npc.id}이 포장마차를 지나간다 (${x}, ${y})`)
      }
    }
  }
  const fisher = OUTDOOR_NPCS.find(npc => npc.kind === 'fisher')
  assert.equal(fisher.fixed, true)
  assert.equal(fisher.mutter.length >= 3, true, '혼자 중얼거린다')
  // 데크 낚시 자리(612, 470)에서 낚시꾼 말 걸기 범위(22)는 닿지 않는다.
  const reach = { x: fisher.path[0].x, y: fisher.path[0].y - 20, width: 24, height: 40 }
  const dx = Math.max(Math.abs(612 - reach.x) - reach.width / 2, 0), dy = Math.max(Math.abs(470 - reach.y) - reach.height / 2, 0)
  assert.ok(Math.hypot(dx, dy) > 22)
})
