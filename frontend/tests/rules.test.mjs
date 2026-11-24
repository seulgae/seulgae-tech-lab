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
