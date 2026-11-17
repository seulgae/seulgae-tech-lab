import assert from 'node:assert/strict'
import test from 'node:test'
import { COIN_EVENT, inventoryStore } from '../src/features/inventory/inventoryStore.ts'
import { parseServerMessage } from '../src/features/multiplayer/model/protocol.ts'

const id = '00000000-0000-4000-8000-0000000000aa'

test('바닥 아이템 메시지는 방 안 좌표·이름 길이·개수를 검사한다', () => {
  const ground = items => JSON.stringify({ type: 'ground', items })
  const fish = { id, kind: 'FISH', name: '붕어', sizeCm: 23, x: 600, y: 470 }
  assert.equal(parseServerMessage(ground([fish])).items[0].name, '붕어')
  assert.throws(() => parseServerMessage(ground([{ ...fish, x: 900 }])))
  assert.throws(() => parseServerMessage(ground([{ ...fish, name: '' }])))
  assert.throws(() => parseServerMessage(ground(Array.from({ length: 31 }, () => fish))))
  assert.equal(parseServerMessage(JSON.stringify({ type: 'inventory_changed' })).type, 'inventory_changed')
  assert.equal(parseServerMessage(JSON.stringify({ type: 'inventory_error', reason: 'login' })).reason, 'login')
})

test('가방: 비회원은 쓸 수 없고, 동전이 늘면 동전 연출 이벤트를 보낸다, 오락실은 결과별로 구분', async () => {
  const original = globalThis.fetch
  const events = []
  const listener = event => events.push(event.detail.amount)
  // node의 globalThis에는 이벤트 메서드가 없어 브라우저 window처럼 붙인다.
  const target = new EventTarget()
  Object.assign(globalThis, { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) })
  globalThis.addEventListener(COIN_EVENT, listener)
  let coins = 20
  try {
    globalThis.fetch = async () => new Response('', { status: 401 })
    assert.equal((await inventoryStore.refresh()).available, false)
    assert.equal(await inventoryStore.payArcade(), 'free', '비회원은 무료로 즐긴다')
    globalThis.fetch = async () => new Response(JSON.stringify({ coins, items: [], rewardsLeftToday: 10 }), { headers: { 'Content-Type': 'application/json' } })
    await inventoryStore.refresh()
    assert.deepEqual(events, [], '처음 읽을 때는 연출하지 않는다')
    coins = 30
    await inventoryStore.refresh()
    assert.deepEqual(events, [10], '게시물 보상 10원')
    globalThis.fetch = async () => new Response(JSON.stringify({ coins: 29 }), { headers: { 'Content-Type': 'application/json' } })
    assert.equal(await inventoryStore.payArcade(), 'paid')
    assert.equal(inventoryStore.get().coins, 29)
    assert.deepEqual(events, [10, -1])
    globalThis.fetch = async () => new Response('', { status: 409 })
    assert.equal(await inventoryStore.payArcade(), 'broke')
    globalThis.fetch = async (url, options) => { assert.deepEqual(JSON.parse(options.body), { species: '붕어', cm: 23 }); return new Response('', { status: 409 }) }
    assert.equal(await inventoryStore.storeFish('붕어', 23), false, '가방이 꽉 차면 false')
  } finally { globalThis.fetch = original; globalThis.removeEventListener(COIN_EVENT, listener); delete globalThis.addEventListener; delete globalThis.removeEventListener; delete globalThis.dispatchEvent }
})
