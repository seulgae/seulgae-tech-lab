import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_RULES, actionCost, costText, rulesStore, snackOf, tiredMessage } from '../src/features/rules/rulesStore.ts'

test('기본 규칙은 V23 시드와 같고 문구는 규칙 숫자로 만든다', () => {
  rulesStore.reset()
  assert.equal(costText('ARCADE_PLAY'), 'HP -3, 기력 -5')
  assert.equal(actionCost('NONE').hpCost, 0)
  assert.equal(costText('NONE'), 'HP·기력이 들지 않음')
  assert.equal(snackOf('WATER')?.fatigueGain, 2)
  assert.match(tiredMessage('QA_MOVE'), /HP 3, 기력 5 필요.*커피\(기력 \+5\)나 케이크\(HP \+10\)/)
})

test('서버 규칙을 받으면 바꾼 숫자가 화면 문구에 반영되고, 실패하면 기본값을 지킨다', async () => {
  const original = globalThis.fetch
  try {
    rulesStore.reset()
    globalThis.fetch = async () => new Response('', { status: 500 })
    assert.equal((await rulesStore.load()).actions.length, DEFAULT_RULES.actions.length)
    const changed = { ...DEFAULT_RULES, actions: [{ code: 'ARCADE_PLAY', name: '오락실 한 판', hpCost: 0, fatigueCost: 2, description: '' }] }
    let calls = 0
    globalThis.fetch = async url => { calls++; assert.equal(url, '/api/rules'); return Response.json(changed) }
    await rulesStore.load()
    await rulesStore.load()
    assert.equal(calls, 1, '한 번만 받는다')
    assert.equal(costText('ARCADE_PLAY'), '기력 -2')
  } finally { globalThis.fetch = original; rulesStore.reset() }
})

test('숫자 규칙과 새 행동·간식 기본값(V24)이 있고, 서버가 values를 안 주면 기본값을 쓴다', async () => {
  const { ruleValue } = await import('../src/features/rules/rulesStore.ts')
  rulesStore.reset()
  assert.equal(ruleValue('REST_EVERY_SEC'), 60)
  assert.equal(costText('FURNITURE_PLACE'), 'HP -2')
  assert.equal(costText('STOCK_TRADE'), '기력 -1')
  assert.equal(snackOf('LUNCHBOX')?.hpGain, 25)
  const original = globalThis.fetch
  try {
    const { values, ...withoutValues } = DEFAULT_RULES
    assert.ok(values.length > 0)
    globalThis.fetch = async () => Response.json(withoutValues)
    await rulesStore.load()
    assert.equal(ruleValue('REST_HP'), 3)
  } finally { globalThis.fetch = original; rulesStore.reset() }
})

test('폰 브라우저 생활 가이드는 지금 규칙으로 표를 만든다', async () => {
  const { openSite, GUIDE_ADDRESS, SITE_ADDRESSES } = await import('../src/features/phone/fakeWeb.ts')
  assert.ok(SITE_ADDRESSES.includes(GUIDE_ADDRESS))
  rulesStore.reset({ ...DEFAULT_RULES, actions: [{ code: 'GAMBLE_BET', name: '내기', hpCost: 0, fatigueCost: 9, description: '오락실' }] })
  try {
    const page = openSite('https://www.guide.lab/')
    assert.equal(page.title, '연구소 생활 가이드')
    const tables = page.blocks.filter(block => block.type === 'table')
    assert.equal(tables.length, 3)
    assert.deepEqual(tables[0].rows, [['내기', '기력 -9', '오락실']])
    assert.ok(tables[1].rows.some(row => row[0] === '기숙사 침대에서 쉬기' && row[2] === '60초마다 HP +3 · 기력 +3'))
    assert.deepEqual(tables[2].rows.at(-1), ['연구소장', '100일', '100원', '무제한'])
    for (const table of tables) for (const row of table.rows) assert.equal(row.length, table.head.length)
  } finally { rulesStore.reset() }
})
