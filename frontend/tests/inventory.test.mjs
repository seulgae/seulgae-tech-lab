import assert from 'node:assert/strict'
import test from 'node:test'
import { COIN_EVENT, DRINKS, inventoryStore } from '../src/features/inventory/inventoryStore.ts'
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

test('HP·스태미나: 간식 구매 결과를 구분하고, 바뀐 만큼 변화 이벤트를 보내며, 지치면 오락실을 시작하지 않는다', async () => {
  const { VITALS_EVENT, SNACKS, WORK_COST, vitalsText } = await import('../src/features/inventory/inventoryStore.ts')
  assert.deepEqual(WORK_COST, { hp: 3, fatigue: 5 })
  assert.equal(SNACKS.CAKE.price, 3); assert.equal(SNACKS.CAKE.hp, 10)
  assert.equal(SNACKS.COFFEE.price, 2); assert.equal(SNACKS.COFFEE.fatigue, 5)
  assert.equal(vitalsText({ hp: -3, fatigue: -5 }), 'HP -3 · 스태미나 -5')
  assert.equal(vitalsText({ hp: 10, fatigue: 0 }), 'HP +10')

  const original = globalThis.fetch
  const changes = []
  const target = new EventTarget()
  Object.assign(globalThis, { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) })
  const listener = event => changes.push(event.detail)
  globalThis.addEventListener(VITALS_EVENT, listener)
  const view = (coins, hp, fatigue) => new Response(JSON.stringify({ coins, items: [], rewardsLeftToday: 9, hp, hpMax: 50, fatigue, fatigueMax: 50 }), { headers: { 'Content-Type': 'application/json' } })
  try {
    globalThis.fetch = async () => view(10, 47, 45)
    await inventoryStore.refresh()
    changes.length = 0 // 앞 테스트의 상태에서 바뀐 첫 읽기는 세지 않는다
    await inventoryStore.refresh()
    assert.deepEqual(changes, [], '그대로면 이벤트 없음')
    let sent
    globalThis.fetch = async (url, options) => { sent = [url, JSON.parse(options.body)]; return view(7, 50, 45) }
    assert.equal(await inventoryStore.buySnack('CAKE'), 'bought')
    assert.deepEqual(sent, ['/api/inventory/snack', { kind: 'CAKE' }])
    assert.deepEqual(changes, [{ hp: 3, fatigue: 0 }], '최대치에서 멈춘 실제 변화량')
    assert.equal(inventoryStore.get().hp, 50)
    globalThis.fetch = async () => new Response('', { status: 422 })
    assert.equal(await inventoryStore.buySnack('CAKE'), 'full')
    globalThis.fetch = async () => new Response('', { status: 409 })
    assert.equal(await inventoryStore.buySnack('COFFEE'), 'broke')
    globalThis.fetch = async () => new Response('', { status: 423 })
    assert.equal(await inventoryStore.payArcade(), 'tired', '기운이 없으면 오락실을 시작하지 않는다')
    globalThis.fetch = async () => new Response('', { status: 401 })
    assert.equal(await inventoryStore.buySnack('COFFEE'), 'guest', '비회원은 무료로 즐기기만')
  } finally { globalThis.fetch = original; globalThis.removeEventListener(VITALS_EVENT, listener); delete globalThis.addEventListener; delete globalThis.removeEventListener; delete globalThis.dispatchEvent }
})

test('식물 행운: 당첨이면 받은 만큼 동전 이벤트를 보내고, 꽝·비회원은 0', async () => {
  const original = globalThis.fetch
  const target = new EventTarget()
  Object.assign(globalThis, { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) })
  const amounts = []
  const listener = event => amounts.push(event.detail.amount)
  globalThis.addEventListener(COIN_EVENT, listener)
  try {
    let url
    globalThis.fetch = async (path, options) => { url = [path, options.method]; return new Response(JSON.stringify({ won: 2, coins: 12 })) }
    assert.equal(await inventoryStore.shakePlant(), 2)
    assert.deepEqual(url, ['/api/inventory/plant', 'POST'])
    assert.equal(inventoryStore.get().coins, 12)
    assert.deepEqual(amounts, [2])
    globalThis.fetch = async () => new Response(JSON.stringify({ won: 0, coins: 12 }))
    assert.equal(await inventoryStore.shakePlant(), 0)
    globalThis.fetch = async () => new Response('', { status: 401 })
    assert.equal(await inventoryStore.shakePlant(), 0, '비회원은 그냥 흔들기만')
    assert.deepEqual(amounts, [2], '꽝이면 동전 연출 없음')
  } finally { globalThis.fetch = original; globalThis.removeEventListener(COIN_EVENT, listener); delete globalThis.addEventListener; delete globalThis.removeEventListener; delete globalThis.dispatchEvent }
})


test('자판기 네 음료는 종류만 전송하고 실제 잔액·회복은 서버 응답을 따른다', async () => {
  const original = globalThis.fetch
  try {
    for (const kind of Object.keys(DRINKS)) {
      assert.equal(DRINKS[kind].price, kind === 'WATER' ? 1 : 2)
      let sent
      globalThis.fetch = async (url, options) => {
        sent = [url, JSON.parse(options.body)]
        return Response.json({ coins: 3, items: [], rewardsLeftToday: 0, hp: 47, hpMax: 50, fatigue: 49, fatigueMax: 50 })
      }
      assert.equal(await inventoryStore.buySnack(kind), 'bought')
      assert.deepEqual(sent, ['/api/inventory/snack', { kind }])
      assert.equal(inventoryStore.get().coins, 3)
      assert.equal(inventoryStore.get().fatigue, 49)
      for (const [status, result] of [[409, 'broke'], [422, 'full'], [500, 'error']]) {
        globalThis.fetch = async () => new Response('', { status })
        assert.equal(await inventoryStore.buySnack(kind), result)
        assert.equal(inventoryStore.get().coins, 3)
      }
    }
  } finally { globalThis.fetch = original }
})
