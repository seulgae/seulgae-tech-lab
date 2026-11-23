import assert from 'node:assert/strict'
import test from 'node:test'
import { canPlace, fits } from '../src/features/dorm/dormApi.ts'

const desk = { code: 'DESK', name: '책상', price: 15, width: 112, height: 40, blocking: true }
const rug = { code: 'RUG', name: '러그', price: 6, width: 96, height: 64, blocking: false }
const view = {
  coins: 0, catalog: [desk, rug],
  furniture: [
    { id: 'a', code: 'DESK', placed: true, x: 200, y: 200 },
    { id: 'b', code: 'DESK', placed: false, x: null, y: null },
    { id: 'c', code: 'RUG', placed: false, x: null, y: null },
  ],
}

test('개인 기숙사: 벽 밖과 문 앞에는 부딪히는 가구를 놓지 않는다(서버와 같은 규칙)', () => {
  assert.equal(fits(desk, 30, 200), false)
  assert.equal(fits(desk, 400, 560), false)
  assert.equal(fits(rug, 400, 560), true)
  assert.equal(fits(desk, 600, 300), true)
})

test('개인 기숙사: 부딪히는 가구끼리는 겹치지 않고, 러그는 아무 데나 놓는다', () => {
  assert.equal(canPlace(view, 'b', 220, 210), false)
  assert.equal(canPlace(view, 'b', 500, 300), true)
  assert.equal(canPlace(view, 'c', 200, 220), true)
  assert.equal(canPlace(view, 'a', 210, 200), true)
})
