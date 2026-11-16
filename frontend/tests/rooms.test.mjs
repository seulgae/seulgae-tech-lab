import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient from '../src/features/multiplayer/MultiplayerClient.ts'
import { ROOMS, roomObstacles } from '../src/game/maps/rooms.ts'
import { constrainedPosition, setRoomObstacles } from '../src/game/multiplayer/networkPosition.ts'
const own={id:'00000000-0000-4000-8000-000000000001',nickname:'연구원',x:400,y:400,facing:'down',moving:false,ack:-1}
test('방 전환은 같은 소켓을 유지하고 이전 방 세대의 상태·채팅을 무시한다', t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']})
 const original={window:globalThis.window,document:globalThis.document,WebSocket:globalThis.WebSocket,sessionStorage:globalThis.sessionStorage}
 class Socket {static all=[];readyState=1;bufferedAmount=0;sent=[];constructor(){Socket.all.push(this)}send(s){this.sent.push(JSON.parse(s))}close(){}receive(m){this.onmessage({data:JSON.stringify(m)})}}
 Object.assign(globalThis,{window:Object.assign(new EventTarget(),{location:{protocol:'http:',host:'localhost:5188'}}),document:Object.assign(new EventTarget(),{hidden:false}),WebSocket:Socket,sessionStorage:{getItem(){return null},setItem(){}}})
 const snapshots=[],chats=[],histories=[],times=[]
 const c=new MultiplayerClient({snapshot:(players, _selfId, time)=>{snapshots.push(players);times.push(time)},chat:m=>chats.push(m),history:m=>histories.push(m)})
 try {
  c.start();const s=Socket.all[0];s.receive({type:'welcome',selfId:own.id,players:[own],maxPlayers:5,protocolVersion:4,roomId:'lobby',roomEpoch:0})
  assert.equal(c.changeRoom('lobby-to-development'),true);assert.equal(c.changeRoom('lobby-to-development'),false)
  c.recordStep({x:1,y:0},16)
  assert.equal(s.sent.at(-1).type,'room_change')
  s.receive({type:'room_error',reason:'거리 부족',roomId:'lobby',roomEpoch:0})
  assert.equal(c.isTravelling(),false);assert.equal(c.currentRoom(),'lobby')
  assert.equal(c.changeRoom('lobby-to-development'),true)
  s.receive({type:'room_changed',selfId:own.id,players:[{...own,y:460}],time:1000,roomId:'development-lab',roomEpoch:1})
  assert.equal(c.currentRoom(),'development-lab');assert.equal(c.isTravelling(),false);assert.equal(times.at(-1),1000)
  const n=snapshots.length
  s.receive({type:'state',tick:999,players:[{...own,x:700}],roomId:'lobby',roomEpoch:0})
  s.receive({type:'chat_history',messages:[],roomId:'lobby',roomEpoch:0})
  assert.equal(snapshots.length,n);assert.equal(histories.length,1)
  c.recordStep({x:1,y:0},16)
  assert.equal(s.sent.at(-1).inputs[0].seq,1);assert.equal(s.sent.at(-1).roomEpoch,1)
  s.receive({type:'state',tick:1,players:[{...own,x:403,y:460,ack:1}],roomId:'development-lab',roomEpoch:1})
  assert.equal(snapshots.at(-1)[0].x,403);assert.equal(Socket.all.length,1);assert.equal(chats.length,0)
 } finally {c.destroy();Object.assign(globalThis,original)}
})

test('네 방의 모든 스폰은 가구 밖이고 출입구는 로비 중심으로 연결된다',()=>{
 for(const [id,room] of Object.entries(ROOMS)){
  const obstacles=roomObstacles(id)
  for(const a of obstacles){ const p=room.spawn; assert.ok(p.x+10<=a.x-a.width/2 || p.x-10>=a.x+a.width/2 || p.y<=a.y-a.height/2 || p.y-16>=a.y+a.height/2, `${id}: spawn collision`) }
  assert.equal(room.doors.length,id==='lobby'?3:1)
  for(const door of room.doors)assert.ok(Object.hasOwn(ROOMS,door.target))
 }
 setRoomObstacles(roomObstacles('server-room'))
 assert.equal(constrainedPosition(100,220,100,0).x,126)
 setRoomObstacles(roomObstacles('lobby'))
})
