import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient from '../src/features/multiplayer/MultiplayerClient.ts'
import { parseServerMessage } from '../src/features/multiplayer/model/protocol.ts'
import { formatUptime, parseBuildInfo, parseLabStatus } from '../src/features/lab/model/labTypes.ts'

const own = { id: '00000000-0000-4000-8000-000000000001', nickname: '연구원', x: 400, y: 460, facing: 'down', moving: false, ack: -1 }
const chat = { type: 'chat_message', messageId: '00000000-0000-4000-8000-0000000000aa', playerId: own.id, nickname: '연구원', message: '안녕', sentAt: '2026-11-16T00:00:00Z', roomId: 'meeting-room', roomEpoch: 1 }

test('채팅 범위는 room/table만 허용하고 테이블 거부 사유를 인식한다', () => {
  assert.equal(parseServerMessage(JSON.stringify({ ...chat, scope: 'table' })).scope, 'table')
  assert.equal(parseServerMessage(JSON.stringify(chat)).scope, undefined)
  assert.throws(() => parseServerMessage(JSON.stringify({ ...chat, scope: 'everyone' })))
  assert.equal(parseServerMessage(JSON.stringify({ type: 'chat_error', reason: 'not_at_table', roomId: 'lobby', roomEpoch: 0 })).reason, 'not_at_table')
})

test('테이블 대화만 scope를 보내고 일반 대화의 전송 형식은 유지한다', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  const original = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket, sessionStorage: globalThis.sessionStorage }
  class Socket { static all = []; readyState = 1; bufferedAmount = 0; sent = []; constructor() { Socket.all.push(this) } send(s) { this.sent.push(JSON.parse(s)) } close() {} receive(m) { this.onmessage({ data: JSON.stringify(m) }) } }
  Object.assign(globalThis, { window: Object.assign(new EventTarget(), { location: { protocol: 'http:', host: 'localhost:5188' } }), document: Object.assign(new EventTarget(), { hidden: false }), WebSocket: Socket, sessionStorage: { getItem() { return null }, setItem() {} } })
  const client = new MultiplayerClient({})
  try {
    client.start(); client.changeRoom('lobby-to-development'); t.mock.timers.tick(0); client.changeRoom('development-to-meeting') // 멀티플레이는 회의실에서만: 회의실 문을 열 때 연결한다
    const socket = Socket.all[0]
    socket.receive({ type: 'welcome', selfId: own.id, players: [own], maxPlayers: 5, protocolVersion: 4, roomId: 'lobby', roomEpoch: 0 })
    assert.equal(client.sendChat('모두에게'), true)
    assert.deepEqual(socket.sent.at(-1), { type: 'chat', message: '모두에게', roomEpoch: 0 })
    t.mock.timers.tick(1100)
    assert.equal(client.sendChat('테이블에만', 'table'), true)
    assert.deepEqual(socket.sent.at(-1), { type: 'chat', message: '테이블에만', scope: 'table', roomEpoch: 0 })
  } finally { client.destroy(); Object.assign(globalThis, original) }
})

test('연구소 상태·빌드 응답은 형식을 확인하고 가동 시간을 줄여 표시한다', () => {
  const status = { status: 'UP', uptimeSeconds: 3725, onlinePlayers: 1, maxPlayers: 5, rooms: [{ id: 'lobby', name: '중앙 로비', players: 1 }], memory: { usedMb: 80, maxMb: 512 }, serverTime: '2026-11-16T00:00:00Z' }
  assert.deepEqual(parseLabStatus(status), status)
  assert.throws(() => parseLabStatus({ ...status, onlinePlayers: -1 }))
  assert.throws(() => parseLabStatus({ ...status, rooms: [{ id: 'lobby', name: 3, players: 1 }] }))
  assert.equal(parseBuildInfo({ version: '0.0.1-SNAPSHOT', commit: 'abc1234', builtAt: null, javaVersion: '17' }).commit, 'abc1234')
  assert.throws(() => parseBuildInfo({ version: '0.0.1', commit: '<script>', builtAt: null, javaVersion: '17' }))
  assert.equal(formatUptime(3725), '1시간 2분')
  assert.equal(formatUptime(42), '0분 42초')
  assert.equal(formatUptime(90000), '1일 1시간')
})
