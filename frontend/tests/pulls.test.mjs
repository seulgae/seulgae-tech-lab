import assert from 'node:assert/strict'
import test from 'node:test'
import { ago, fetchPulls, parsePulls } from '../src/features/pulls/pullsApi.ts'
import { ROOMS, nearestInteraction } from '../src/game/maps/rooms.ts'

const pull = (number, url = `https://github.com/seulgae/seulgae-tech-lab/pull/${number}`) =>
  ({ number, title: `PR ${number}`, author: 'seulgae', draft: false, createdAt: '2026-11-23T00:00:00Z', mergedAt: null, url })

test('개발 연구실 슈퍼컴퓨터는 GitHub PR 목록을 연다(연구 기록은 지웠다)', () => {
  const target = nearestInteraction('development-lab', 400, 290)
  assert.equal(target?.kind, 'pull-requests')
  assert.equal(target?.label, 'GitHub PR 목록')
  assert.ok(Object.values(ROOMS).every(room => room.interactions.every(i => i.kind !== 'research')))
})

test('PR 목록 응답: github.com 링크만 남기고, 모양이 이상하면 거절, 지난 시간 표기', async () => {
  const data = parsePulls({ repo: 'seulgae/seulgae-tech-lab', open: [pull(1), pull(2, 'javascript:alert(1)')], merged: [pull(3)], fetchedAt: null, stale: false })
  assert.deepEqual(data.open.map(p => p.number), [1], '위험한 링크는 버린다')
  assert.throws(() => parsePulls({ repo: 'x', open: 'no', merged: [], stale: false }))
  const original = globalThis.fetch
  try {
    let seen
    globalThis.fetch = async url => { seen = url; return new Response(JSON.stringify({ repo: 'r/r', open: [], merged: [], fetchedAt: null, stale: true })) }
    assert.equal((await fetchPulls()).stale, true)
    assert.equal(seen, '/api/lab/pulls')
    globalThis.fetch = async () => new Response('', { status: 500 })
    await assert.rejects(fetchPulls(), /PR 목록/)
  } finally { globalThis.fetch = original }
  const now = Date.parse('2026-11-23T12:00:00Z')
  assert.equal(ago('2026-11-23T11:30:00Z', now), '30분 전')
  assert.equal(ago('2026-11-23T09:00:00Z', now), '3시간 전')
  assert.equal(ago('2026-11-20T12:00:00Z', now), '3일 전')
  assert.equal(ago(null, now), '')
})
