import assert from 'node:assert/strict'
import test from 'node:test'
import { NICKNAME_PATTERN, authStore, canWrite, isMine } from '../src/features/auth/authStore.ts'
import { BoardError, rememberToken } from '../src/features/boards/boardsApi.ts'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('카카오 키가 없으면 누구나 쓰고, 키가 있으면 로그인 회원만 쓴다', () => {
  assert.equal(canWrite({ kakaoEnabled: false, member: null }), true)
  assert.equal(canWrite({ kakaoEnabled: true, member: null }), false)
  assert.equal(canWrite({ kakaoEnabled: true, member: { id: 'm', nickname: '연구원' } }), true)
  assert.equal(new BoardError(401).message, '카카오 로그인 후 쓸 수 있어요.')
})

test('로그인 상태와 내가 쓴 글 ID를 읽고, 로그아웃하면 비운다', async t => {
  const calls = []
  const fetcher = async (url, init = {}) => {
    calls.push([url, init.method ?? 'GET'])
    if (url === '/api/auth/me') return json({ kakaoEnabled: true, member: { id: 'm1', nickname: '슬개' } })
    if (url === '/api/auth/me/owned') return json({ agendaIds: ['a1'] })
    return new Response(null, { status: 204 })
  }
  authStore.reset()
  t.after(() => authStore.reset())
  await authStore.load(fetcher)
  const state = authStore.get()
  assert.equal(state.loaded, true)
  assert.equal(state.member.nickname, '슬개')
  assert.equal(isMine(state, 'agenda', 'a1'), true)
  assert.equal(isMine(state, 'agenda', 'r1'), false, '내 안건 목록에 없으면 내 글이 아니다')
  await authStore.logout(fetcher)
  assert.equal(authStore.get().member, null)
  assert.equal(isMine(authStore.get(), 'agenda', 'a1'), false)
  assert.deepEqual(calls.map(call => call.join(' ')), ['/api/auth/me GET', '/api/auth/me/owned GET', '/api/auth/logout POST'])
})

test('로그인 확인이 실패해도 사이트는 비로그인으로 동작한다', async t => {
  authStore.reset()
  t.after(() => authStore.reset())
  await authStore.load(async () => { throw new Error('offline') })
  assert.deepEqual([authStore.get().loaded, authStore.get().kakaoEnabled, authStore.get().member], [true, false, null])
  await authStore.load(async () => json({}, 500))
  assert.equal(canWrite(authStore.get()), true)
})

test('로그인 전 수정 키로 쓴 글도 계속 내 글로 표시된다', t => {
  const memory = new Map()
  const original = globalThis.localStorage
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  t.after(() => { globalThis.localStorage = original })
  rememberToken('old-post', 'T'.repeat(43))
  assert.equal(isMine({ ownedAgendas: new Set() }, 'agenda', 'old-post'), true)
})

test('닉네임은 로비 이름표 규칙(1~16자 글자·숫자·_·-)을 따른다', () => {
  for (const ok of ['슬개', 'lab_01', '연구원-a1b2', '가'.repeat(16)]) assert.ok(NICKNAME_PATTERN.test(ok), ok)
  for (const bad of ['', '공백 있음', '가'.repeat(17), '<b>']) assert.ok(!NICKNAME_PATTERN.test(bad), bad)
})
