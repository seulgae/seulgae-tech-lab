import assert from 'node:assert/strict'
import test from 'node:test'
import { clockText, isoDate, monthGrid, monthKey, seoulNow, shiftMonth } from '../src/features/phone/phoneTime.ts'
import { HOME_ADDRESS, SITE_ADDRESSES, labWeather, normalizeAddress, openSite } from '../src/features/phone/fakeWeb.ts'
import { PHONE_APPS } from '../src/features/phone/phoneApps.ts'
import { addTodo, amountText, deleteSns, fetchTodos, searchRecipients, setTodoDone, transfer, writeSns } from '../src/features/phone/phoneApi.ts'

test('폰 앱: 물고기 보관함·은행·캘린더는 회원만, 브라우저·SNS는 누구나', () => {
  assert.deepEqual(PHONE_APPS.map(app => app.id), ['fish', 'bank', 'calendar', 'browser', 'sns', 'furniture'])
  assert.deepEqual(PHONE_APPS.filter(app => app.memberOnly).map(app => app.id), ['fish', 'bank', 'calendar', 'furniture'])
})

test('폰 시계·달력: 한국 시간, 일요일 시작 달력, 달 넘기기', () => {
  // 2026-11-21 15:30 UTC = 11-22 00:30 KST
  assert.deepEqual(seoulNow(new Date('2026-11-21T15:30:00Z')), { year: 2026, month: 11, day: 22, hour: 0, minute: 30 })
  assert.equal(clockText(new Date('2026-11-22T03:05:00Z')), '12:05')
  const november = monthGrid(2026, 11)
  assert.deepEqual(november[0], [1, 2, 3, 4, 5, 6, 7], '2026년 11월 1일은 일요일')
  assert.deepEqual(november.at(-1), [29, 30, null, null, null, null, null])
  assert.ok(monthGrid(2026, 2).every(week => week.length === 7))
  assert.equal(monthGrid(2028, 2).flat().filter(Boolean).length, 29, '윤년 2월')
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 })
  assert.equal(isoDate(2026, 3, 9), '2026-03-09')
  assert.equal(monthKey(2026, 3), '2026-03')
})

test('가짜 인터넷: 주소를 다듬고, 연구소 사이트만 열며 없는 주소는 안내 페이지', () => {
  assert.equal(normalizeAddress('  HTTPS://www.News.lab/ '), 'news.lab')
  assert.equal(normalizeAddress(''), HOME_ADDRESS)
  for (const address of SITE_ADDRESSES) {
    const page = openSite(address, 12)
    assert.equal(page.address, address)
    assert.ok(page.blocks.length > 0, address)
    for (const block of page.blocks) if (block.type === 'link') assert.ok(SITE_ADDRESSES.includes(block.href), `${address} → ${block.href}`)
  }
  assert.ok(openSite('fish.wiki').blocks.some(block => block.type === 'list' && block.items.includes('황금 잉어: 15~30원')))
  const missing = openSite('google.com')
  assert.equal(missing.theme, 'missing')
  assert.equal(missing.address, 'google.com')
  assert.match(labWeather(19).tip, /포장마차/)
  assert.notEqual(labWeather(3).sky, labWeather(13).sky)
})

test('폰 API 요청 형식과 상태별 안내', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options.method ?? 'GET', options.body ? JSON.parse(options.body) : null])
    return options.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response('[]')
  }
  try {
    await searchRecipients(' 낚시 ')
    await transfer('id-1', 5)
    await fetchTodos('2026-11')
    await addTodo('2026-11-22', '  블로그 쓰기 ')
    await setTodoDone('t/1', true)
    await writeSns(' 안녕 ')
    await deleteSns('p1')
    assert.deepEqual(calls, [
      ['/api/bank/members?q=%EB%82%9A%EC%8B%9C', 'GET', null],
      ['/api/bank/transfer', 'POST', { to: 'id-1', amount: 5 }],
      ['/api/todos?month=2026-11', 'GET', null],
      ['/api/todos', 'POST', { date: '2026-11-22', title: '블로그 쓰기' }],
      ['/api/todos/t%2F1', 'PATCH', { done: true }],
      ['/api/sns', 'POST', { content: '안녕' }],
      ['/api/sns/p1', 'DELETE', null],
    ])
    globalThis.fetch = async () => new Response('', { status: 409 })
    await assert.rejects(() => transfer('id-1', 5), /잔액이 모자라요/)
    globalThis.fetch = async () => new Response('', { status: 429 })
    await assert.rejects(() => writeSns('또'), /하루 20개/)
    globalThis.fetch = async () => new Response('', { status: 401 })
    await assert.rejects(() => fetchTodos('2026-11'), /로그인/)
  } finally { globalThis.fetch = original }
  assert.equal(amountText(10), '+10원')
  assert.equal(amountText(-3), '-3원')
})
