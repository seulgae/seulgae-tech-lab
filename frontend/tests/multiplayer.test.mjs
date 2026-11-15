import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient from '../src/features/multiplayer/MultiplayerClient.ts'
import { lobbySocketUrl, parseServerMessage, validNickname } from '../src/features/multiplayer/model/protocol.ts'

const first = { id: '00000000-0000-4000-8000-000000000001', nickname: '연구원-0001', x: 400, y: 400, facing: 'down', moving: false, ack: -1 }
const second = { ...first, id: '00000000-0000-4000-8000-000000000002', nickname: '연구원-0002', x: 428 }
const welcome = (self = first, players = [self]) => ({ type: 'welcome', selfId: self.id, players, maxPlayers: 5 })

test('동일 서비스의 HTTPS는 WSS로 연결하고 임시 이름만 쿼리에 넣는다', () => {
  const url = new URL(lobbySocketUrl({ protocol: 'https:', host: 'lab.example' }, '연구원-1234'))
  assert.equal(url.protocol, 'wss:')
  assert.equal(url.pathname, '/ws/lobby')
  assert.equal(url.searchParams.get('nickname'), '연구원-1234')
  assert.equal(new URL(lobbySocketUrl({ protocol: 'http:', host: 'localhost:5188' })).protocol, 'ws:')
  assert.equal(validNickname('<script>'), false)
  assert.equal(validNickname('a'.repeat(17)), false)
})

test('스냅샷 크기·플레이어 수·ID·좌표·방향·본인 ID를 검증한다', () => {
  assert.deepEqual(parseServerMessage(JSON.stringify(welcome())), welcome())
  for (const invalid of [
    { ...welcome(), players: [first, first] },
    { ...welcome(), selfId: second.id },
    { ...welcome(), players: [{ ...first, x: 99999 }] },
    { ...welcome(), players: [{ ...first, facing: 'north' }] },
    { ...welcome(), players: [{ ...first, ack: 1.5 }] },
    { type: 'unknown', players: [first] },
  ]) assert.throws(() => parseServerMessage(JSON.stringify(invalid)))
  assert.throws(() => parseServerMessage('x'.repeat(8193)))
})

test('연결·목록 변경·재연결·입력 전송·종료 정리를 중복 없이 처리한다', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 })
  const originals = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket, sessionStorage: globalThis.sessionStorage }
  const storage = new Map()
  class Socket {
    static instances = []
    readyState = 0
    bufferedAmount = 0
    sent = []
    constructor(url) { this.url = url; Socket.instances.push(this) }
    open() { this.readyState = 1; this.onopen?.() }
    receive(message) { this.onmessage?.({ data: JSON.stringify(message) }) }
    send(message) { this.sent.push(JSON.parse(message)) }
    drop(code) { this.readyState = 3; this.onclose?.({ code }) }
    close(code = 1000) {
      assert.ok(code === 1000 || code >= 3000 && code <= 4999)
      this.lastCloseCode = code
      this.drop(code)
    }
  }
  globalThis.window = Object.assign(new EventTarget(), { location: { protocol: 'http:', host: 'localhost:5188' } })
  globalThis.document = Object.assign(new EventTarget(), { hidden: false })
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  globalThis.WebSocket = Socket
  const snapshots = [], statuses = []
  const client = new MultiplayerClient({ snapshot: (players, selfId) => snapshots.push({ players, selfId }), status: status => statuses.push(status) })
  try {
    client.start(); client.start()
    assert.equal(Socket.instances.length, 1)
    const a = Socket.instances[0]
    a.open(); a.receive(welcome())
    assert.equal(statuses.at(-1).phase, 'online')
    client.setInput({ x: 1, y: 0 })
    assert.deepEqual(a.sent.at(-1), { type: 'input', x: 1, y: 0, seq: 2 })
    t.mock.timers.tick(50)
    assert.equal(a.sent.at(-1).seq, 3)
    window.dispatchEvent(new Event('blur'))
    assert.equal(a.sent.at(-1).x, 0)
    a.receive({ type: 'joined', player: second })
    assert.equal(statuses.at(-1).online, 2)
    a.receive({ type: 'state', tick: 2, players: [first, { ...second, x: 440, moving: true }] })
    a.receive({ type: 'state', tick: 1, players: [first] })
    assert.equal(snapshots.at(-1).players.length, 2)
    a.receive({ type: 'left', id: second.id })
    assert.equal(statuses.at(-1).online, 1)
    a.drop(1006)
    assert.deepEqual(snapshots.at(-1), { players: [], selfId: null })
    t.mock.timers.tick(500)
    assert.equal(Socket.instances.length, 2)
    const b = Socket.instances[1]
    b.open(); b.receive(welcome(second))
    assert.equal(snapshots.at(-1).selfId, second.id)
    assert.equal(b.sent[0].seq, 1)
    b.receive({ type: 'state', tick: 1, players: [{ ...second, x: 10000 }] })
    assert.equal(b.lastCloseCode, 4002)
    const sentCount = b.sent.length
    client.destroy()
    t.mock.timers.tick(30000)
    assert.equal(b.sent.length, sentCount)
    assert.equal(Socket.instances.length, 2)
    assert.equal(b.onmessage, null)
  } finally {
    client.destroy()
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
    t.mock.timers.reset()
  }
})
