import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchResearchPage, fetchResearchRecord } from '../src/features/research/api/researchApi.ts'

test('research API builds list/detail URLs, propagates abort signal and rejects errors', async () => {
  const originalFetch = globalThis.fetch
  const signal = new AbortController().signal
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/research-records?limit=10&offset=20')
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
