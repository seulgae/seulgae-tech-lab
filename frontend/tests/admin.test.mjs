import assert from 'node:assert/strict'
import test from 'node:test'
import { isReadOnly, quoteIdent, tableQuery } from '../src/features/admin/adminApi.ts'
import { authStore } from '../src/features/auth/authStore.ts'

test('쿼리 콘솔: 조회 쿼리만 바로 실행하고, 바꾸는 쿼리는 한 번 더 묻는다', () => {
  for (const sql of ['SELECT 1', '  select * from lab.tb_lab_item', '-- 메모\nSELECT 1', 'WITH a AS (SELECT 1) SELECT * FROM a', 'EXPLAIN SELECT 1', 'SHOW search_path'])
    assert.equal(isReadOnly(sql), true, sql)
  for (const sql of ['DELETE FROM lab.tb_lab_item', 'update lab.tb_lab_item set name = 1', 'INSERT INTO a VALUES (1)', 'WITH d AS (DELETE FROM a RETURNING *) SELECT * FROM d',
    'EXPLAIN ANALYZE DELETE FROM a', 'TRUNCATE a', 'DROP TABLE a', '/* x */ delete from a'])
    assert.equal(isReadOnly(sql), false, sql)
})

test('쿼리 콘솔: 테이블을 누르면 조회 쿼리를 넣는다(필요하면 따옴표)', () => {
  assert.equal(tableQuery({ schema: 'lab', name: 'tb_lab_guestbook', type: 'TABLE' }), 'SELECT * FROM lab.tb_lab_guestbook LIMIT 100;')
  assert.equal(quoteIdent('flyway_schema_history'), 'flyway_schema_history')
  assert.equal(quoteIdent('Weird"Name'), '"Weird""Name"')
})

test('로그인 상태: 서버가 알려 준 관리자 여부를 회원일 때만 믿는다', async () => {
  const me = body => async url => new Response(JSON.stringify(url.endsWith('/owned') ? {} : body))
  authStore.reset()
  await authStore.load(me({ kakaoEnabled: true, member: { id: 'a', nickname: '방장' }, admin: true }))
  assert.equal(authStore.get().admin, true)
  authStore.reset()
  await authStore.load(me({ kakaoEnabled: true, member: null, admin: true }))
  assert.equal(authStore.get().admin, false, '로그인하지 않았으면 관리자가 아니다')
  authStore.reset()
})

test('로그인 상태: 회원 등급(1~3)을 받고, 비회원·이상한 값은 0', async () => {
  const me = body => async url => new Response(JSON.stringify(url.endsWith('/owned') ? {} : body))
  authStore.reset()
  await authStore.load(me({ kakaoEnabled: true, member: { id: 'a', nickname: '운영자' }, admin: false, level: 2 }))
  assert.equal(authStore.get().level, 2)
  authStore.reset()
  await authStore.load(me({ kakaoEnabled: true, member: { id: 'a', nickname: '해커' }, admin: false, level: 99 }))
  assert.equal(authStore.get().level, 0)
  authStore.reset()
  await authStore.load(me({ kakaoEnabled: true, member: null, admin: false, level: 3 }))
  assert.equal(authStore.get().level, 0, '로그인하지 않았으면 0')
  authStore.reset()
})

test('등급 신청 API: 신청·내 상태·관리자 승인 요청 형식', async () => {
  const { LEVEL_NAMES, applyLevel, decideLevel, fetchMyLevel } = await import('../src/features/admin/levelApi.ts')
  assert.deepEqual([LEVEL_NAMES[1], LEVEL_NAMES[2], LEVEL_NAMES[3]], ['일반 사용자', '운영자', '관리자'])
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options = {}) => { calls.push([url, options.method ?? 'GET', options.body ? JSON.parse(options.body) : null]); return new Response(JSON.stringify({ level: 1, request: null })) }
  try {
    await fetchMyLevel()
    await applyLevel(3, '  관리하고 싶어요  ')
    await decideLevel('00000000-0000-4000-8000-0000000000aa', true)
    assert.deepEqual(calls, [
      ['/api/level-requests/me', 'GET', null],
      ['/api/level-requests', 'POST', { level: 3, reason: '관리하고 싶어요' }],
      ['/api/admin/level-requests/00000000-0000-4000-8000-0000000000aa', 'POST', { approve: true }],
    ])
    globalThis.fetch = async () => new Response('', { status: 409 })
    await assert.rejects(() => applyLevel(2, '또'), /검토 중/)
  } finally { globalThis.fetch = original }
})
