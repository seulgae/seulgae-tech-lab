import assert from 'node:assert/strict'
import test from 'node:test'
import { isReadOnly, quoteIdent, tableQuery } from '../src/features/admin/adminApi.ts'
import { authStore } from '../src/features/auth/authStore.ts'

test('쿼리 콘솔: 조회 쿼리만 바로 실행하고, 바꾸는 쿼리는 한 번 더 묻는다', () => {
  for (const sql of ['SELECT 1', '  select * from lab.items', '-- 메모\nSELECT 1', 'WITH a AS (SELECT 1) SELECT * FROM a', 'EXPLAIN SELECT 1', 'SHOW search_path'])
    assert.equal(isReadOnly(sql), true, sql)
  for (const sql of ['DELETE FROM lab.items', 'update lab.items set name = 1', 'INSERT INTO a VALUES (1)', 'WITH d AS (DELETE FROM a RETURNING *) SELECT * FROM d',
    'EXPLAIN ANALYZE DELETE FROM a', 'TRUNCATE a', 'DROP TABLE a', '/* x */ delete from a'])
    assert.equal(isReadOnly(sql), false, sql)
})

test('쿼리 콘솔: 테이블을 누르면 조회 쿼리를 넣는다(필요하면 따옴표)', () => {
  assert.equal(tableQuery({ schema: 'lab', name: 'guestbook_entries', type: 'TABLE' }), 'SELECT * FROM lab.guestbook_entries LIMIT 100;')
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
