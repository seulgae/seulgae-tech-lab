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

// V2: 연구 아이디어 일지(수정 키), 회의 안건
const json = (method, body, token) => ({ method, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Edit-Token': token } : {}) }, body: body && JSON.stringify(body) })
assert.deepEqual(await (await fetch(`${route}/ideas/next-number`)).json(), { number: 1 })
const idea = await fetch(`${route}/ideas`, json('POST', { title: '연구 아이디어 일지 #1', content: '가'.repeat(130) }))
assert.equal(idea.status, 201)
const created = await idea.json()
assert.match(created.editToken, /^[A-Za-z0-9_-]{43}$/)
assert.equal(created.record.summary, '가'.repeat(130))
assert.deepEqual(await (await fetch(`${route}/ideas/next-number`)).json(), { number: 2 })
assert.equal((await fetch(`${route}/ideas`, json('POST', { title: '연구 아이디어 일지 #2', content: '가'.repeat(131) }))).status, 400)
assert.equal((await fetch(`${route}/${created.record.id}`, json('PUT', { title: '연구 아이디어 일지 #1', content: '남의 글' }))).status, 403)
assert.equal((await fetch(`${route}/${ids[0]}`, json('PUT', { title: 'x', content: 'y' }, created.editToken))).status, 403, 'V1 기록은 수정 불가')
const updated = await (await fetch(`${route}/${created.record.id}`, json('PUT', { title: '연구 아이디어 일지 #1', content: '고친 내용' }, created.editToken))).json()
assert.equal(updated.content, '고친 내용')
assert.equal((await fetch(`${route}/${created.record.id}`, json('DELETE', null, created.editToken))).status, 204)
assert.equal((await fetch(`${route}/${created.record.id}`)).status, 404)

const agendas = `${base}/api/meeting-agendas`
assert.deepEqual(await (await fetch(agendas)).json(), { items: [], hasMore: false })
const agenda = await fetch(agendas, json('POST', { title: '분위기리뉴얼', content: '방마다 색과 이벤트를 정해요' }))
assert.equal(agenda.status, 201)
const madeAgenda = await agenda.json()
assert.equal(madeAgenda.agenda.title, '분위기리뉴얼')
assert.equal((await fetch(agendas, json('POST', { title: '아홉글자짜리제목', content: '내용' }))).status, 201)
assert.equal((await fetch(agendas, json('POST', { title: '아홉 글자짜리 제목', content: '내용' }))).status, 400)
assert.equal((await fetch(agendas, json('POST', { title: '두줄', content: '가'.repeat(131) }))).status, 400)
const listed = await (await fetch(`${agendas}?limit=1`)).json()
assert.equal(listed.items.length, 1)
assert.equal(listed.hasMore, true)
assert.equal('editTokenHash' in listed.items[0], false)
assert.equal((await fetch(`${agendas}/${madeAgenda.agenda.id}`, json('DELETE'))).status, 403)
const changed = await (await fetch(`${agendas}/${madeAgenda.agenda.id}`, json('PUT', { title: '회고', content: '바뀐 안건' }, madeAgenda.editToken))).json()
assert.equal(changed.title, '회고')
assert.ok(changed.updatedAt)
assert.equal((await fetch(`${agendas}/${madeAgenda.agenda.id}`, json('DELETE', null, madeAgenda.editToken))).status, 204)
assert.equal((await fetch(`${agendas}/00000000-0000-0000-0000-000000000000`, json('DELETE', null, madeAgenda.editToken))).status, 404)
// V3: 카카오 키가 없는 환경에서는 로그인이 꺼지고, 글쓰기는 기존 수정 키 방식 그대로다.
// 관리자실(쿼리 콘솔): 로그인하지 않았으면 관리자가 아니다. 관리자 API는 로그인부터 요구한다.
assert.deepEqual(await (await fetch(`${base}/api/auth/me`)).json(), { kakaoEnabled: false, member: null, admin: false, level: 0 })
assert.equal((await fetch(`${base}/api/admin/tables`)).status, 401)
// 식물 행운: 비회원은 추첨하지 않는다.
assert.equal((await fetch(`${base}/api/inventory/plant`, json('POST', null))).status, 401)
// 포장마차: 비회원은 팔 수 없다.
assert.equal((await fetch(`${base}/api/inventory/sell`, json('POST', { itemId: '00000000-0000-4000-8000-0000000000aa' }))).status, 401)
assert.equal((await fetch(`${base}/api/admin/sql`, json('POST', { sql: 'SELECT 1' }))).status, 401)
assert.deepEqual(await (await fetch(`${base}/api/auth/me/owned`)).json(), { recordIds: [], agendaIds: [] })
assert.equal((await fetch(`${base}/api/auth/kakao/login`, { redirect: 'manual' })).status, 404)
console.log('Disposable PostgreSQL HTTP integration checks passed: creation, roundtrip, pagination, validation, 404, idea journal and agenda ownership, auth disabled.')

// 등급 신청: 비회원은 신청·조회할 수 없고, 관리자 목록은 로그인부터 요구한다.
assert.equal((await fetch(`${base}/api/level-requests/me`)).status, 401)
assert.equal((await fetch(`${base}/api/level-requests`, json('POST', { level: 3, reason: '관리하고 싶어요' }))).status, 401)
assert.equal((await fetch(`${base}/api/admin/level-requests`)).status, 401)
// 폰 앱: 은행·할 일은 회원만, SNS는 읽기만 누구나
assert.equal((await fetch(`${base}/api/bank`)).status, 401)
assert.equal((await fetch(`${base}/api/bank/members?q=a`)).status, 401)
assert.equal((await fetch(`${base}/api/bank/transfer`, json('POST', { to: '00000000-0000-4000-8000-000000000001', amount: 1 }))).status, 401)
assert.equal((await fetch(`${base}/api/todos?month=2026-11`)).status, 401)
assert.equal((await fetch(`${base}/api/todos`, json('POST', { date: '2026-11-22', title: '할 일' }))).status, 401)
assert.equal((await fetch(`${base}/api/sns`)).status, 200)
assert.deepEqual(await (await fetch(`${base}/api/sns`)).json(), [])
assert.equal((await fetch(`${base}/api/sns`, json('POST', { content: '안녕' }))).status, 401)
// 서버실 랙 용량 조사: 공개 집계값만, CI에는 SSH 설정이 없어 호스트 값은 비어 있다.
const capacity = await (await fetch(`${base}/api/lab/capacity`)).json()
assert.equal(capacity.probe.state, 'NOT_CONFIGURED')
assert.equal(capacity.memory, null)
assert.ok(capacity.heap.maxMb > 0 && capacity.uptime.jvmSeconds >= 0)
assert.equal(JSON.stringify(capacity).includes('host.docker'), false)
