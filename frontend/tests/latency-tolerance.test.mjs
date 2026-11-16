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
  client.start()
  const socket = Socket.all[0]
  socket.receive({ type: 'welcome', selfId: own.id, players: [own], maxPlayers: 5, protocolVersion: 4, roomId: 'lobby', roomEpoch: 0 })
  t.after(() => { client.destroy(); Object.assign(globalThis, original) })
  return { client, socket }
}

test('방 이동 응답이 수 초 늦어도 스스로 끊지 않고, 제한 시간을 넘으면 재연결로 복구한다', t => {
  const { client, socket } = setup(t)
  assert.ok(ROOM_RESPONSE_TIMEOUT_MS >= 10000, '1초 왕복·수 초 정체를 견딜 여유')
  assert.equal(client.changeRoom('lobby-to-development'), true)
  // 서버 상태는 계속 오므로 10초 무응답 감지(4001)와 구분된다.
  for (let elapsed = 0; elapsed < 6000; elapsed += 500) { t.mock.timers.tick(500); socket.receive({ type: 'state', tick: elapsed / 500 + 1, players: [own], roomId: 'lobby', roomEpoch: 0 }) }
  assert.deepEqual(socket.closes, [], '기존 5초 제한이면 여기서 4005로 끊겼다')
  socket.receive({ type: 'room_changed', selfId: own.id, players: [{ ...own, y: 460 }], roomId: 'development-lab', roomEpoch: 1 })
  assert.equal(client.currentRoom(), 'development-lab')

  t.mock.timers.tick(1100)
  assert.equal(client.changeRoom('development-to-lobby'), true)
  for (let elapsed = 0; elapsed <= ROOM_RESPONSE_TIMEOUT_MS; elapsed += 500) { t.mock.timers.tick(500); socket.receive({ type: 'state', tick: 100 + elapsed / 500, players: [{ ...own, y: 460 }], roomId: 'development-lab', roomEpoch: 1 }) }
  assert.deepEqual(socket.closes.at(-1), [4005, 'Room response timeout'])
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
