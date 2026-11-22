import assert from 'node:assert/strict'
import test from 'node:test'
import MultiplayerClient from '../src/features/multiplayer/MultiplayerClient.ts'
import { ROOMS, roomObstacles } from '../src/game/maps/rooms.ts'
import { constrainedPosition, setRoomObstacles } from '../src/game/multiplayer/networkPosition.ts'
const own={id:'00000000-0000-4000-8000-000000000001',nickname:'연구원',x:400,y:400,facing:'down',moving:false,ack:-1}
test('회의실 밖은 서버 없이 방을 옮기고, 회의실 문에서만 연결하며, 나오면 연결을 끊는다', t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']})
 const original={window:globalThis.window,document:globalThis.document,WebSocket:globalThis.WebSocket,sessionStorage:globalThis.sessionStorage}
 class Socket {static all=[];readyState=1;bufferedAmount=0;sent=[];closes=[];constructor(){Socket.all.push(this)}send(s){this.sent.push(JSON.parse(s))}close(code,reason){this.closes.push([code,reason])}receive(m){this.onmessage({data:JSON.stringify(m)})}}
 Object.assign(globalThis,{window:Object.assign(new EventTarget(),{location:{protocol:'http:',host:'localhost:5188'}}),document:Object.assign(new EventTarget(),{hidden:false}),WebSocket:Socket,sessionStorage:{getItem(){return null},setItem(){}}})
 const snapshots=[],histories=[],rooms=[],statuses=[]
 const c=new MultiplayerClient({snapshot:(players)=>snapshots.push(players),history:m=>histories.push(m),room:(id,pending)=>rooms.push([id,pending]),status:s=>statuses.push(s)})
 try {
  c.start()
  assert.equal(Socket.all.length,0,'시작할 때 연결하지 않는다');assert.equal(statuses.at(-1).phase,'solo')
  assert.equal(c.changeRoom('lobby-to-development'),true);assert.equal(c.changeRoom('lobby-to-development'),false,'옮기는 중에는 한 번만')
  assert.equal(c.isTravelling(),true)
  t.mock.timers.tick(0)
  assert.equal(c.currentRoom(),'development-lab');assert.equal(c.isTravelling(),false);assert.deepEqual(rooms.at(-1),['development-lab',false])
  assert.equal(c.changeRoom('lobby-to-office-4'),false,'지금 방에 없는 문은 쓸 수 없다')
  assert.equal(c.changeRoom('development-to-lobby'),true);t.mock.timers.tick(0)
  assert.equal(c.currentRoom(),'lobby');assert.equal(Socket.all.length,0,'회의실 밖 이동은 서버 없이')
  assert.equal(c.changeRoom('lobby-to-office-4'),true);t.mock.timers.tick(0)
  assert.equal(c.currentRoom(),'office-4');assert.equal(ROOMS['office-4'].name,'뭘만들지');assert.equal(Socket.all.length,0)
  assert.equal(c.changeRoom('office-4-to-lobby'),true);t.mock.timers.tick(0)
  assert.equal(c.changeRoom('lobby-to-development'),true);t.mock.timers.tick(0)
  assert.equal(c.changeRoom('development-to-meeting'),true)
  assert.equal(Socket.all.length,1);assert.equal(c.currentRoom(),'development-lab','입장 확인 전에는 아직 개발 연구실')
  const s=Socket.all[0]
  s.receive({type:'welcome',selfId:own.id,players:[{...own,y:480}],maxPlayers:5,protocolVersion:4,time:1000,roomId:'meeting-room',roomEpoch:0})
  assert.equal(c.currentRoom(),'meeting-room');assert.equal(c.isTravelling(),false);assert.equal(c.isOnline(),true)
  assert.equal(statuses.at(-1).phase,'online')
  c.recordStep({x:1,y:0},16)
  assert.equal(s.sent.at(-1).type,'move');assert.equal(s.sent.at(-1).roomEpoch,0)
  s.receive({type:'state',tick:1,players:[{...own,x:403,y:480,ack:1}],roomId:'meeting-room',roomEpoch:0})
  assert.equal(snapshots.at(-1)[0].x,403)
  assert.equal(c.changeRoom('meeting-to-development'),true)
  assert.deepEqual(s.closes.at(-1),[1000,'Left meeting room'],'회의실을 나오면 연결을 끊는다')
  assert.deepEqual(snapshots.at(-1),[]);assert.deepEqual(histories.at(-1),[],'회의실 채팅은 비운다')
  t.mock.timers.tick(0)
  assert.equal(c.currentRoom(),'development-lab');assert.equal(c.isOnline(),false);assert.equal(statuses.at(-1).phase,'solo')
  t.mock.timers.tick(20000)
  assert.equal(Socket.all.length,1,'나온 뒤에는 다시 연결하지 않는다')
 } finally {c.destroy();Object.assign(globalThis,original)}
})

test('모든 방의 스폰은 가구 밖이고 출입구는 로비 중심으로 연결된다',()=>{
 for(const [id,room] of Object.entries(ROOMS)){
  const obstacles=roomObstacles(id)
  for(const a of obstacles){ const p=room.spawn; assert.ok(p.x+10<=a.x-a.width/2 || p.x-10>=a.x+a.width/2 || p.y<=a.y-a.height/2 || p.y-16>=a.y+a.height/2, `${id}: spawn collision`) }
  // 로비와 개발 연구실은 문이 다섯(옆문 넷 + 아래 가운데), 나머지 방은 들어온 곳으로 가는 문 하나
  const hub=id==='lobby'||id==='development-lab'
  assert.equal(room.doors.length,hub?5:1, id)
  // 서버실·관리자실·서비스 연구실·회의실은 개발 연구실로, 오락실·빈 사무실(2번)·뭘만들지·바깥은 로비로 돌아간다.
  const fromLab=['server-room','control-room','office-1','meeting-room'].includes(id)
  for(const door of room.doors)assert.ok(hub||door.target===(fromLab?'development-lab':'lobby'), id)
  if(id==='development-lab') assert.deepEqual(room.doors.map(d=>[d.target,d.x,d.y]),[['office-1',70,250],['control-room',730,250],['server-room',70,520],['meeting-room',730,520],['lobby',400,540]])
  for(const door of room.doors)assert.ok(Object.hasOwn(ROOMS,door.target))
 }
 setRoomObstacles(roomObstacles('server-room'))
 assert.equal(constrainedPosition(100,220,100,0).x,126)
 setRoomObstacles(roomObstacles('lobby'))
})

test('회의실 밖에서도 바닥 아이템은 REST로 읽고 버리며, 관리자실 문은 관리자만 연다', async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']})
 const original={window:globalThis.window,document:globalThis.document,WebSocket:globalThis.WebSocket,fetch:globalThis.fetch}
 const calls=[]
 const fish={id:'00000000-0000-4000-8000-0000000000aa',kind:'FISH',name:'붕어',sizeCm:23,x:600,y:470}
 globalThis.fetch=async (url,options={})=>{calls.push([url,options.method??'GET',options.body?JSON.parse(options.body):null])
  return new Response(JSON.stringify(url.includes('outdoor')||options.body?[fish]:[]))}
 Object.assign(globalThis,{window:Object.assign(new EventTarget(),{location:{protocol:'http:',host:'localhost:5188'}}),document:Object.assign(new EventTarget(),{hidden:false}),WebSocket:class{constructor(){throw new Error('회의실 밖에서는 연결하지 않는다')}}})
 const grounds=[]
 const c=new MultiplayerClient({ground:items=>grounds.push(items)})
 const settle=()=>new Promise(resolve=>setImmediate(resolve))
 try {
  c.start();c.changeRoom('lobby-to-outdoor');t.mock.timers.tick(0);await settle()
  assert.deepEqual(calls.at(-1),['/api/inventory/ground?room=outdoor','GET',null])
  assert.equal(c.ground()[0].name,'붕어')
  c.setPosition(610.4,472.6)
  assert.equal(c.dropItem(fish.id),true);await settle()
  assert.deepEqual(calls.at(-1),['/api/inventory/drop','POST',{itemId:fish.id,room:'outdoor',x:610,y:473}],'내 위치를 함께 보낸다')
  c.changeRoom('outdoor-to-lobby');t.mock.timers.tick(0);await settle()
  assert.equal(c.canEnter('control-room'),false);assert.equal(c.canEnter('server-room'),true)
  c.changeRoom('lobby-to-development');t.mock.timers.tick(0);await settle()
  assert.equal(c.changeRoom('development-to-control'),false,'관리자가 아니면 관리자실에 들어가지 않는다')
  c.setAdmin(true)
  assert.equal(c.changeRoom('development-to-control'),true);t.mock.timers.tick(0);await settle()
  assert.equal(c.currentRoom(),'control-room')
 } finally {c.destroy();Object.assign(globalThis,original)}
})

test('관리자실 문: 로그인 확인이 클라이언트보다 먼저 끝나도(setAdmin 없이) 로그인 상태로 연다', () => {
  let admin = true
  // 연결·타이머를 만들지 않는 판단만 본다(정리할 것이 없다).
  const c = new MultiplayerClient({}, { isAdmin: () => admin })
  assert.equal(c.canEnter('control-room'), true, '이미 관리자로 로그인돼 있으면 바로 열린다')
  admin = false
  assert.equal(c.canEnter('control-room'), false, '관리자가 아니면 닫힌다')
  assert.equal(c.canEnter('server-room'), true)
  assert.equal(new MultiplayerClient({}).canEnter('control-room'), false, '로그인 정보가 없으면 닫힌다')
})
