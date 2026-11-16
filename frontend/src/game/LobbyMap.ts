import Phaser from 'phaser'
import { ROOMS, roomObjects } from './maps/rooms'
import type { RoomId } from './maps/rooms'
import { COMPUTER, createFloorData, WALLS } from './maps/lobbyLayout'

export { COMPUTER } from './maps/lobbyLayout'

/** 타일 바닥, 가구 외형과 고정 충돌체를 각각 만든다. */
export default function createLobbyMap(scene: Phaser.Scene, roomId: RoomId = 'lobby') {
  const objects = roomObjects(roomId)
  const map = scene.make.tilemap({ data: createFloorData(), tileWidth: 16, tileHeight: 16 })
  const tiles = map.addTilesetImage('lab-tiles', 'lab-tiles', 16, 16)!
  map.createLayer(0, tiles, 0, 0)!.setScale(2).setDepth(-100)

  scene.add.tileSprite(400, 32, 400, 32, 'wall').setScale(2).setDepth(60)
  scene.add.rectangle(12, 320, 24, 560, 0x426b68).setDepth(0)
  scene.add.rectangle(788, 320, 24, 560, 0x426b68).setDepth(0)
  scene.add.rectangle(400, 588, 800, 24, 0x355a58).setDepth(0)

  const obstacles = scene.physics.add.staticGroup()
  for (const area of [...WALLS, ...objects.map(object => object.body)]) {
    const body = scene.add.rectangle(area.x, area.y, area.width, area.height).setVisible(false)
    obstacles.add(body)
  }
  for (const object of objects) {
    scene.add.image(object.x, object.bottom, object.texture).setOrigin(0.5, 1).setScale(2).setDepth(object.bottom)
  }

  // 출입구는 서버가 거리를 검증하는 상호작용 지점이며 벽을 통과시키지 않는다.
  scene.add.text(400, 24, ROOMS[roomId].name, {
    fontFamily: 'monospace', fontSize: '16px', color: '#264a4b',
  }).setOrigin(0.5).setDepth(65)
  scene.add.text(400, 244, roomId === 'meeting-room' ? 'MEETING TABLE' : 'RECEPTION', {
    fontFamily: 'monospace', fontSize: '10px', color: '#e4e5ce',
  }).setOrigin(0.5).setDepth(1)
  scene.add.text(152, 404, roomId === 'development-lab' ? 'CODE / BUILD / LEARN' : 'EXPERIMENTS', {
    fontFamily: 'monospace', fontSize: '10px', color: '#6a7d70',
  }).setOrigin(0.5).setDepth(1)
  scene.add.text(400, 545, ROOMS[roomId].name, {
    fontFamily: 'monospace', fontSize: '12px', color: '#687e72',
  }).setOrigin(0.5).setDepth(1)
  for (const door of ROOMS[roomId].doors) {
    scene.add.image(door.x, door.y, 'door').setOrigin(0.5, 1).setScale(2).setDepth(1)
    scene.add.text(door.x, door.y + 18, ROOMS[door.target as RoomId].name, { fontSize: '12px', color: '#fff2d2' }).setOrigin(.5).setDepth(2)
  }
  if (roomId === 'server-room') {
    const cables = scene.add.graphics().setDepth(-1)
    cables.lineStyle(2, 0x78958b, .7)
    for (const x of [160, 280, 520, 640]) cables.lineBetween(x, 260, x, 290)
    cables.lineBetween(160, 290, 640, 290)
  }
  if (roomId === 'development-lab') {
    for (const x of [180, 620]) scene.add.text(x, 194, 'const lab = build()', { fontSize: '10px', color: '#b6e8a7', backgroundColor: '#183c40' }).setOrigin(.5).setDepth(300)
  }
  if (roomId === 'meeting-room') {
    scene.add.rectangle(400, 110, 160, 42, 0xd5e4cd).setStrokeStyle(4, 0x557b70).setDepth(160)
    scene.add.text(400, 105, 'IDEAS / DISCUSS', {fontSize:'12px', color:'#264a4b'}).setOrigin(.5).setDepth(161)
  }
  const computerHighlight = scene.add.rectangle(COMPUTER.x, COMPUTER.y + 2, 126, 80)
    .setStrokeStyle(2, 0xf3d690).setFillStyle(0xf3d690, 0.08).setDepth(COMPUTER.y + COMPUTER.height / 2 + 1).setVisible(false)
  return { obstacles, computerHighlight }
}
