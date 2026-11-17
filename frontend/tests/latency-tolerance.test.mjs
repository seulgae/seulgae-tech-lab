import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient, { INPUT_BACKPRESSURE_BYTES, ROOM_RESPONSE_TIMEOUT_MS } from '../src/features/multiplayer/MultiplayerClient.ts'
import { closeCause } from '../src/features/multiplayer/model/protocol.ts'

const own = { id: '00000000-0000-4000-8000-000000000001', nickname: '연구원', x: 400, y: 530, facing: 'down', moving: false, ack: -1 }

/** 운영 Funnel 경로처럼 응답이 늦게 오는 가짜 소켓 */
function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  const original = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket, sessionStorage: globalThis.sessionStorage }
  class Socket { static all = []; readyState = 1; bufferedAmount = 0; sent = []; closes = []; constructor() { Socket.all.push(this) } send(s) { this.sent.push(JSON.parse(s)) } close(code, reason) { this.closes.push([code, reason]) } receive(m) { this.onmessage({ data: JSON.stringify(m) }) } }
  Object.assign(globalThis, { window: Object.assign(new EventTarget(), { location: { protocol: 'https:', host: 'lab.example' } }), document: Object.assign(new EventTarget(), { hidden: false }), WebSocket: Socket, sessionStorage: { getItem() { return null }, setItem() {}, removeItem() {} } })
  const client = new MultiplayerClient({})
  client.start(); client.changeRoom('lobby-to-meeting') // 멀티플레이는 회의실에서만: 회의실 문을 열 때 연결한다
  const socket = Socket.all[0]
  socket.receive({ type: 'welcome', selfId: own.id, players: [own], maxPlayers: 5, protocolVersion: 4, roomId: 'meeting-room', roomEpoch: 0 })
  t.after(() => { client.destroy(); Object.assign(globalThis, original) })
  return { client, socket }
}

test('회의실 연결이 수 초 늦어도 문 앞에서 기다리고, 제한 시간을 넘으면 연결을 접고 그 자리에 남는다', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  const original = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket, sessionStorage: globalThis.sessionStorage }
  class Socket { static all = []; readyState = 0; bufferedAmount = 0; sent = []; closes = []; constructor() { Socket.all.push(this) } send(s) { this.sent.push(JSON.parse(s)) } close(code, reason) { this.closes.push([code, reason]) } receive(m) { this.onmessage({ data: JSON.stringify(m) }) } }
  Object.assign(globalThis, { window: Object.assign(new EventTarget(), { location: { protocol: 'https:', host: 'lab.example' } }), document: Object.assign(new EventTarget(), { hidden: false }), WebSocket: Socket, sessionStorage: { getItem() { return null }, setItem() {}, removeItem() {} } })
  const rooms = []
  const client = new MultiplayerClient({ room: (roomId, pending) => rooms.push([roomId, pending]) })
  t.after(() => { client.destroy(); Object.assign(globalThis, original) })
  client.start()
  assert.equal(Socket.all.length, 0, '로비에서는 연결하지 않는다')
  assert.ok(ROOM_RESPONSE_TIMEOUT_MS >= 10000, '연결 수립 3~5초를 견딜 여유')
  assert.equal(client.changeRoom('lobby-to-meeting'), true)
  assert.equal(Socket.all.length, 1)
  t.mock.timers.tick(6000)
  assert.equal(client.isTravelling(), true, '연결을 기다리는 동안 문 앞에 머문다')
  assert.equal(client.currentRoom(), 'lobby')
  t.mock.timers.tick(ROOM_RESPONSE_TIMEOUT_MS)
  assert.equal(client.isTravelling(), false)
  assert.equal(client.currentRoom(), 'lobby', '회의실에 들어가지 못하면 로비에 남는다')
  assert.deepEqual(Socket.all[0].closes.at(-1), [1000, 'Left meeting room'])
  assert.deepEqual(rooms.at(-1), ['lobby', false])
  t.mock.timers.tick(20000)
  assert.equal(Socket.all.length, 1, '포기한 뒤에는 다시 연결하지 않는다')
})

test('업로드가 잠시 막혀 수 KB가 쌓여도 입력을 계속 보내고, 한도를 넘을 때만 끊는다', t => {
  const { client, socket } = setup(t)
  assert.ok(INPUT_BACKPRESSURE_BYTES >= 16384)
  socket.bufferedAmount = 8000
  client.recordStep({ x: 1, y: 0 }, 16)
  t.mock.timers.tick(60)
  assert.equal(socket.sent.at(-1).type, 'move')
  assert.deepEqual(socket.closes, [])
  socket.bufferedAmount = INPUT_BACKPRESSURE_BYTES + 1
  client.recordStep({ x: 1, y: 0 }, 16)
  t.mock.timers.tick(60)
  assert.deepEqual(socket.closes.at(-1), [4003, 'Input backpressure'])
})

test('종료 코드는 콘솔에서 읽을 수 있는 원인으로 바뀐다', () => {
  assert.equal(closeCause(4005), '클라이언트: 방 이동 응답 지연')
  assert.equal(closeCause(1008, 'Movement backlog exceeded'), '서버가 입력을 거부함: Movement backlog exceeded')
  assert.equal(closeCause(4500), '서버: 전송 지연·대기열 초과로 연결 정리')
  assert.match(closeCause(4999, 'x'), /4999: x/)
})
