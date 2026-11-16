import test from 'node:test'
import assert from 'node:assert/strict'
import { joystickInput, combineDirections } from '../src/game/input/mobileInput.ts'

test('조이스틱은 중앙 떨림을 무시하고 사방·대각선을 정수 방향으로 만든다', () => {
  assert.deepEqual(joystickInput(3, -2, 40).direction, { x: 0, y: 0 })
  for (const [dx, dy, x, y] of [[30, 1, 1, 0], [-30, 1, -1, 0], [0, -30, 0, -1],
    [0, 30, 0, 1], [30, 30, 1, 1], [-30, -30, -1, -1], [30, -30, 1, -1], [-30, 30, -1, 1]]) {
    assert.deepEqual(joystickInput(dx, dy, 40).direction, { x, y })
  }
  const outside = joystickInput(300, 400, 40)
  assert.equal(Math.hypot(outside.offset.x, outside.offset.y), 40)
  assert.deepEqual(outside.direction, { x: 1, y: 1 })
})

test('키보드와 터치를 동시에 사용해도 방향 크기가 늘지 않고 반대 입력은 상쇄된다', () => {
  assert.deepEqual(combineDirections({ x: 1, y: 0 }, { x: 1, y: -1 }), { x: 1, y: -1 })
  assert.deepEqual(combineDirections({ x: -1, y: 1 }, { x: 1, y: -1 }), { x: 0, y: 0 })
  assert.deepEqual(combineDirections({ x: 0, y: -1 }, { x: 0, y: 0 }), { x: 0, y: -1 })
})
