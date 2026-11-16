import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient from '../src/features/multiplayer/MultiplayerClient.ts'
import { lobbySocketUrl, parseServerMessage, validNickname, validChatText } from '../src/features/multiplayer/model/protocol.ts'

const first = { id: '00000000-0000-4000-8000-000000000001', nickname: '연구원-0001', x: 400, y: 400, facing: 'down', moving: false, ack: -1 }
const second = { ...first, id: '00000000-0000-4000-8000-000000000002', nickname: '연구원-0002', x: 428 }
const welcome = (self = first, players = [self]) => ({ type: 'welcome', selfId: self.id, players, maxPlayers: 5, protocolVersion: 3 })
const chat = (index = 1) => ({ type: 'chat_message', messageId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  playerId: first.id, nickname: first.nickname, message: '안녕하세요! <b>일반 텍스트</b>', sentAt: '2026-11-16T00:00:00Z' })

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
  assert.throws(() => parseServerMessage('x'.repeat(65537)))
  assert.deepEqual(parseServerMessage(JSON.stringify(chat())), chat())
  assert.equal(validChatText('👋'.repeat(150)), true)
  assert.equal(validChatText('가'.repeat(151)), false)
  assert.equal(validChatText(' \n\t '), false)
  assert.equal(validChatText(String.fromCharCode(0)), false)
  assert.throws(() => parseServerMessage(JSON.stringify({ ...chat(), nickname: '<bad>' })))
  assert.throws(() => parseServerMessage(JSON.stringify({ type: 'chat_history', messages: [chat(), chat()] })))
  assert.throws(() => parseServerMessage(JSON.stringify({ type: 'chat_history', messages: Array.from({length:51}, (_,i) => chat(i)) })))
  const history = { type: 'chat_history', messages: Array.from({length:50}, (_,i) => ({...chat(i),message:'👋'.repeat(150)})) }
  assert.ok(JSON.stringify(history).length > 8192)
  assert.equal(parseServerMessage(JSON.stringify(history)).messages.length, 50)
})

test('연결·목록 변경·재연결·입력 전송·종료 정리를 중복 없이 처리한다', t => {
  const warnings = t.mock.method(console, 'warn', () => {})
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
  const snapshots = [], statuses = [], chats = [], histories = [], errors = []
  let throwOnSnapshot = false
  const client = new MultiplayerClient({ snapshot: (players, selfId) => { if (throwOnSnapshot) throw new Error('render failure'); snapshots.push({ players, selfId }) }, status: status => statuses.push(status), chat: event => chats.push(event), history: messages => histories.push(messages), chatError: error => errors.push(error) })
  try {
    client.start(); client.start()
    assert.equal(Socket.instances.length, 1)
    const a = Socket.instances[0]
    a.open(); a.receive(welcome())
    assert.equal(statuses.at(-1).phase, 'online')
    client.setInput({ x: 1, y: 0 })
    assert.equal(a.sent.length, 1)
    t.mock.timers.tick(50)
    assert.deepEqual(a.sent.at(-1), { type: 'input', x: 1, y: 0, seq: 2 })
    window.dispatchEvent(new Event('blur'))
    t.mock.timers.tick(50)
    assert.equal(a.sent.at(-1).x, 0)
    const idleCount = a.sent.length
    t.mock.timers.tick(1000)
    assert.equal(a.sent.length, idleCount)
    // 프레임마다 방향을 바꿔도 정기 전송을 포함한 합계가 서버 제한(40/s)을 넘지 않는다.
    const beforeChurn = a.sent.length
    for (let i = 0; i < 100; i++) {
      client.setInput({ x: i % 2 ? 1 : -1, y: i % 3 ? 0 : 1 })
      t.mock.timers.tick(10)
    }
    assert.ok(a.sent.length - beforeChurn <= 21) // 양 끝 시각을 포함한 1초 구간
    assert.equal(a.readyState, 1)
    const latest = { x: -1, y: -1 }
    client.setInput(latest)
    t.mock.timers.tick(50)
    assert.equal(a.sent.at(-1).x, latest.x)
    assert.equal(a.sent.at(-1).y, latest.y)
    a.receive({ type: 'joined', player: second })
    assert.equal(statuses.at(-1).online, 2)
    assert.equal(client.sendChat('   '), false)
    const inputCount = a.sent.filter(message => message.type === 'input').length
    assert.equal(client.sendChat('안녕하세요!'), true)
    assert.equal(client.sendChat('빠른 반복'), false)
    assert.equal(errors.at(-1), 'rate_limited')
    assert.equal(a.sent.filter(message => message.type === 'chat').length, 1)
    assert.equal(a.sent.filter(message => message.type === 'input').length, inputCount)
    t.mock.timers.tick(1000)
    const sendBeforeFailure = a.send
    a.send = message => { if (JSON.parse(message).type === 'chat') throw new Error('transport failure'); sendBeforeFailure.call(a, message) }
    assert.equal(client.sendChat('전송 실패 시 입력 유지'), false)
    assert.equal(errors.at(-1), 'unavailable')
    a.send = sendBeforeFailure
    const snapshotCount = snapshots.length
    a.receive({ type: 'chat_history', messages: [chat()] })
    assert.equal(chats.length, 0)
    a.receive(chat()); assert.equal(chats.length, 0)
    for (let i = 2; i <= 61; i++) a.receive(chat(i))
    a.receive(chat(61))
    assert.equal(chats.length, 60)
    assert.equal(snapshots.length, snapshotCount)
    let restored = []
    const detach = client.subscribe({ history: values => { restored = values } })
    assert.equal(restored.length, 50)
    assert.equal(restored[0].messageId, chat(12).messageId)
    detach()
    assert.equal(a.readyState, 1)
    assert.equal(Socket.instances.length, 1)
    throwOnSnapshot = true
    a.receive({ type: 'state', tick: 0, players: [first, second] })
    assert.equal(a.readyState, 1)
    throwOnSnapshot = false
    a.receive({ type: 'state', tick: 2, players: [first, { ...second, x: 440, moving: true }] })
    a.receive({ type: 'state', tick: 1, players: [first] })
    assert.equal(snapshots.at(-1).players.length, 2)
    a.receive({ type: 'left', id: second.id })
    assert.equal(statuses.at(-1).online, 1)
    a.drop(1006)
    const closeDetails = warnings.mock.calls.at(-1).arguments[1]
    assert.equal(closeDetails.code, 1006)
    assert.equal(closeDetails.sentInputs, a.sent.filter(message => message.type === 'input').length)
    assert.ok(closeDetails.sentLastSecond <= 20)
    assert.ok(closeDetails.connectedMs >= 1000)
    assert.deepEqual(snapshots.at(-1), { players: [], selfId: null })
    t.mock.timers.tick(500)
    assert.equal(Socket.instances.length, 2)
    const b = Socket.instances[1]
    b.open(); b.receive(welcome(second))
    assert.equal(snapshots.at(-1).selfId, second.id)
    assert.equal(b.sent[0].seq, 1)
    b.receive({ ...welcome(second, [first, second]), protocolVersion: undefined })
    assert.equal(client.sendChat('이전 서버'), false)
    assert.equal(client.canChat(), false)
    assert.equal(b.sent.filter(message => message.type === 'chat').length, 0)
    // 새 프로토콜은 물리 스텝을 순서대로 묶고 같은 프레임의 방향 변경도 버리지 않는다.
    b.receive({ ...welcome(second, [first, second]), protocolVersion: 4 })
    assert.equal(client.usesCommands(), true)
    const predicted = []
    const unsubscribePrediction = client.subscribe({ predicted: command => predicted.push(command) })
    const beforeCommands = b.sent.length
    client.recordStep({ x: 1, y: 0 }, 1000 / 60)
    client.recordStep({ x: -1, y: 0 }, 1000 / 60)
    client.setInput({ x: 0, y: 0 })
    t.mock.timers.tick(50)
    const batches = b.sent.slice(beforeCommands)
    assert.ok(batches.every(message => message.type === 'move' && message.inputs.length <= 8))
    assert.deepEqual(batches.flatMap(message => message.inputs), predicted)
    assert.deepEqual(predicted.map(command => command.x), [1, -1, 0])
    assert.equal(predicted.at(-1).ms, 0)
    const stoppedCount = b.sent.length
    t.mock.timers.tick(200)
    assert.equal(b.sent.length, stoppedCount)
    unsubscribePrediction()
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
