import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient from '../src/features/multiplayer/MultiplayerClient.ts'
import { parseServerMessage } from '../src/features/multiplayer/model/protocol.ts'
import { tradeMessage } from '../src/features/inventory/tradeMessages.ts'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const offer = { type: 'trade_offer', tradeId: id(9), from: { id: id(2), nickname: '낚시왕' }, item: { id: id(5), kind: 'FISH', name: '메기', sizeCm: 40 }, expiresInMs: 60000 }

test('교환 메시지: 신청·진행 상태를 검사한다', () => {
  assert.equal(parseServerMessage(JSON.stringify(offer)).item.name, '메기')
  assert.throws(() => parseServerMessage(JSON.stringify({ ...offer, tradeId: 'x' })))
  assert.throws(() => parseServerMessage(JSON.stringify({ ...offer, expiresInMs: 10 ** 9 })))
  assert.throws(() => parseServerMessage(JSON.stringify({ ...offer, from: { id: id(2), nickname: '' } })))
  assert.equal(parseServerMessage(JSON.stringify({ type: 'trade_status', tradeId: id(9), status: 'accepted', reason: '' })).status, 'accepted')
  assert.equal(parseServerMessage(JSON.stringify({ type: 'trade_status', status: 'failed', reason: 'login' })).reason, 'login')
  assert.throws(() => parseServerMessage(JSON.stringify({ type: 'trade_status', status: 'stolen' })))
})

test('교환: 회의실에서만 신청·답을 보내고, 받은 신청과 결과를 화면에 넘긴다', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  const original = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket, sessionStorage: globalThis.sessionStorage }
  class Socket { static all = []; readyState = 1; bufferedAmount = 0; sent = []; constructor() { Socket.all.push(this) } send(s) { this.sent.push(JSON.parse(s)) } close() {} receive(m) { this.onmessage({ data: JSON.stringify(m) }) } }
  Object.assign(globalThis, { window: Object.assign(new EventTarget(), { location: { protocol: 'http:', host: 'localhost:5188' } }), document: Object.assign(new EventTarget(), { hidden: false }), WebSocket: Socket, sessionStorage: { getItem() { return null }, setItem() {} } })
  const offers = [], statuses = []
  const client = new MultiplayerClient({ tradeOffer: o => offers.push(o), tradeStatus: s => statuses.push(s) })
  t.after(() => { client.destroy(); Object.assign(globalThis, original) })
  client.start()
  assert.equal(client.offerTrade(id(2), id(5)), false, '회의실 밖에서는 교환하지 않는다')
  client.changeRoom('lobby-to-meeting')
  const socket = Socket.all[0]
  const me = { id: id(1), nickname: '나', x: 400, y: 480, facing: 'down', moving: false, ack: -1 }
  const friend = { ...me, id: id(2), nickname: '낚시왕', x: 440 }
  socket.receive({ type: 'welcome', selfId: me.id, players: [me, friend], maxPlayers: 5, protocolVersion: 4, roomId: 'meeting-room', roomEpoch: 0 })
  assert.deepEqual(client.roomPlayers().map(p => p.nickname), ['낚시왕'], '나를 뺀 같은 방 연구원')
  assert.equal(client.offerTrade(id(2), id(5)), true)
  assert.deepEqual(socket.sent.at(-1), { type: 'trade_offer', to: id(2), itemId: id(5), roomEpoch: 0 })
  socket.receive({ ...offer, roomId: 'meeting-room', roomEpoch: 0 })
  assert.equal(offers[0].from.nickname, '낚시왕')
  assert.equal(offers[0].type, undefined, '화면에는 신청 내용만 넘긴다')
  assert.equal(client.answerTrade(id(9), id(7)), true)
  assert.deepEqual(socket.sent.at(-1), { type: 'trade_answer', tradeId: id(9), itemId: id(7), roomEpoch: 0 })
  client.answerTrade(id(9), null)
  assert.equal(socket.sent.at(-1).itemId, null, '거절은 null')
  socket.receive({ type: 'trade_status', tradeId: id(9), status: 'accepted', reason: '', roomId: 'meeting-room', roomEpoch: 0 })
  assert.deepEqual(statuses, [{ tradeId: id(9), status: 'accepted', reason: '' }])
})

test('교환 안내 문구', () => {
  assert.match(tradeMessage('accepted'), /교환했어요/)
  assert.match(tradeMessage('declined'), /거절/)
  assert.match(tradeMessage('failed', 'login'), /로그인/)
  assert.match(tradeMessage('failed', 'expired'), /60초/)
  assert.equal(tradeMessage('failed', 'unknown'), '교환하지 못했어요.')
})
