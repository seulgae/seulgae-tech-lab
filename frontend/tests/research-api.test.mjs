import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchResearchPage, fetchResearchRecord } from '../src/features/research/api/researchApi.ts'

test('research API builds list/detail URLs, propagates abort signal and rejects errors', async () => {
  const originalFetch = globalThis.fetch
  const signal = new AbortController().signal
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/research-records?limit=5&offset=20')
      assert.equal(options.signal, signal)
      return new Response(JSON.stringify({ items: [], hasMore: false }), { headers: { 'Content-Type': 'application/json' } })
    }
    assert.deepEqual(await fetchResearchPage(signal, 20), { items: [], hasMore: false })
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/research-records/a%2Fb')
      return new Response('', { status: 404 })
    }
    await assert.rejects(fetchResearchRecord('a/b', signal))
    globalThis.fetch = async () => new Response('<html>SPA fallback</html>', { headers: { 'Content-Type': 'text/html' } })
    await assert.rejects(fetchResearchPage(signal), /응답 형식/)
  } finally { globalThis.fetch = originalFetch }
})

test('아이디어 완료 체크는 수정 키 없이 PUT /done으로 보내고, 실패하면 BoardError를 던진다', async () => {
  const { setIdeaDone, BoardError } = await import('../src/features/boards/boardsApi.ts')
  const originalFetch = globalThis.fetch
  try {
    let seen
    globalThis.fetch = async (url, options) => {
      seen = { url, method: options.method, body: options.body, headers: options.headers }
      return new Response(JSON.stringify({ id: 'a/b', done: true }), { headers: { 'Content-Type': 'application/json' } })
    }
    assert.deepEqual(await setIdeaDone('a/b', true), { id: 'a/b', done: true })
    assert.equal(seen.url, '/api/research-records/a%2Fb/done')
    assert.equal(seen.method, 'PUT')
    assert.deepEqual(JSON.parse(seen.body), { done: true })
    assert.equal(seen.headers['X-Edit-Token'], undefined, '누구나 체크하므로 수정 키를 보내지 않는다')
    globalThis.fetch = async () => new Response('', { status: 429 })
    await assert.rejects(setIdeaDone('x', false), error => error instanceof BoardError && error.status === 429)
  } finally { globalThis.fetch = originalFetch }
})
