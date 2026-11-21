import assert from 'node:assert/strict'
import test from 'node:test'
import { COMMON_TIPS, PET_TIPS, follow, nextTip, petTarget } from '../src/game/pet/petTips.ts'
import { ROOMS } from '../src/game/maps/rooms.ts'

test('펫 팁: 모든 방에 짧은 팁이 있고, 아직 안 본 방 팁을 먼저 말한다', () => {
  for (const room of Object.keys(ROOMS)) {
    assert.ok(PET_TIPS[room]?.length >= 2, room)
    for (const tip of PET_TIPS[room]) assert.ok(Array.from(tip).length <= 20, `너무 길다: ${tip}`)
  }
  const seen = []
  for (let i = 0; i < PET_TIPS.lobby.length; i++) {
    const tip = nextTip('lobby', seen, () => 0)
    assert.ok(PET_TIPS.lobby.includes(tip) && !seen.includes(tip))
    seen.push(tip)
  }
  const common = nextTip('lobby', seen, () => 0)
  assert.ok(COMMON_TIPS.includes(common), '방 팁을 다 보면 공통 팁')
})

test('펫 팁: 다 본 뒤에는 처음부터, 직전 팁은 바로 반복하지 않는다', () => {
  const seen = [...PET_TIPS['server-room'], ...COMMON_TIPS]
  for (let r = 0; r < 1; r += 0.1) assert.notEqual(nextTip('server-room', seen, () => r), seen.at(-1))
})

test('펫은 캐릭터가 바라보는 반대쪽 뒤에서, 프레임 속도와 상관없이 같은 빠르기로 따라온다', () => {
  assert.deepEqual(petTarget({ x: 400, y: 300 }, true), { x: 366, y: 290 })
  assert.deepEqual(petTarget({ x: 400, y: 300 }, false), { x: 434, y: 290 })
  const oneStep = follow(0, 100, 100)
  let tenSteps = 0
  for (let i = 0; i < 10; i++) tenSteps = follow(tenSteps, 100, 10)
  assert.ok(Math.abs(oneStep - tenSteps) < 1e-9)
  assert.ok(oneStep > 0 && oneStep < 100)
})
