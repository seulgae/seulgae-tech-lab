import assert from 'node:assert/strict'

// Writes fixtures: run only against a disposable local CI database.
if (process.env.TEST_DATABASE_DISPOSABLE !== 'true') throw new Error('Disposable test database confirmation required')
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:8080'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Local test API required')
let ready = false
for (let attempt = 0; attempt < 30; attempt++) {
  try { if ((await fetch(`${base}/actuator/health`)).ok) { ready = true; break } } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500))
}
assert.ok(ready, 'API must become healthy')
const route = `${base}/api/research-records`
assert.deepEqual(await (await fetch(route)).json(), { items: [], hasMore: false })
const ids = []
for (let n = 0; n < 3; n++) {
  const response = await fetch(route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `CI record ${n}`, summary: 'CI summary', content: `한글 본문 ${n}` }),
  })
  assert.equal(response.status, 201)
  const record = await response.json()
  ids.push(record.id)
  assert.equal(response.headers.get('location'), `/api/research-records/${record.id}`)
  const detail = await (await fetch(`${route}/${record.id}`)).json()
  assert.equal(detail.content, `한글 본문 ${n}`)
}
const page = await (await fetch(`${route}?limit=2`)).json()
assert.equal(page.items.length, 2)
assert.equal(page.hasMore, true)
assert.equal('content' in page.items[0], false)
const second = await (await fetch(`${route}?limit=2&offset=2`)).json()
assert.equal(second.items.length, 1)
assert.equal(second.hasMore, false)
assert.equal(new Set([...page.items, ...second.items].map((item) => item.id)).size, 3)
for (const suffix of ['?limit=0', '?limit=51', '?offset=-1', '/not-a-uuid']) {
  assert.equal((await fetch(route + suffix)).status, 400)
}
assert.equal((await fetch(`${route}/00000000-0000-0000-0000-000000000000`)).status, 404)
assert.equal((await fetch(route, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: ' ', summary: '', content: '' }),
})).status, 400)
console.log('Disposable PostgreSQL HTTP integration checks passed: creation, roundtrip, pagination, validation and 404.')
