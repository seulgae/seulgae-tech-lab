import Phaser from 'phaser'
import { COMPUTER, createFloorData, LOBBY_OBJECTS, WORLD } from './maps/lobbyLayout'

export { COMPUTER } from './maps/lobbyLayout'

/** 타일 바닥, 가구 외형과 고정 충돌체를 각각 만든다. */
export default function createLobbyMap(scene: Phaser.Scene) {
  const map = scene.make.tilemap({ data: createFloorData(), tileWidth: 16, tileHeight: 16 })
  const tiles = map.addTilesetImage('lab-tiles', 'lab-tiles', 16, 16)!
  map.createLayer(0, tiles, 0, 0)!.setScale(2).setDepth(-100)

  scene.add.tileSprite(400, 32, 400, 32, 'wall').setScale(2).setDepth(60)
  scene.add.rectangle(12, 320, 24, 560, 0x426b68).setDepth(0)
  scene.add.rectangle(788, 320, 24, 560, 0x426b68).setDepth(0)
  scene.add.rectangle(400, 588, 800, 24, 0x355a58).setDepth(0)
  scene.add.image(400, 599, 'door').setOrigin(0.5, 1).setScale(2).setDepth(0)

  const obstacles = scene.physics.add.staticGroup()
  const walls = [
    { x: 400, y: 32, width: WORLD.width, height: 64 },
    { x: 400, y: 588, width: WORLD.width, height: WORLD.wall },
    { x: 12, y: 300, width: WORLD.wall, height: WORLD.height },
    { x: 788, y: 300, width: WORLD.wall, height: WORLD.height },
  ]
  for (const area of [...walls, ...LOBBY_OBJECTS.map(object => object.body)]) {
    const body = scene.add.rectangle(area.x, area.y, area.width, area.height).setVisible(false)
    obstacles.add(body)
  }
  for (const object of LOBBY_OBJECTS) {
    scene.add.image(object.x, object.bottom, object.texture).setOrigin(0.5, 1).setScale(2).setDepth(object.bottom)
  }

  // 바닥 장식과 안내판에는 충돌체를 붙이지 않는다. 문은 다음 공간 구현 전까지 닫혀 있다.
  scene.add.text(400, 24, 'SEULGAE  /  TECH LAB', {
    fontFamily: 'monospace', fontSize: '16px', color: '#264a4b',
  }).setOrigin(0.5).setDepth(65)
  scene.add.text(400, 244, 'RECEPTION', {
    fontFamily: 'monospace', fontSize: '10px', color: '#e4e5ce',
  }).setOrigin(0.5).setDepth(1)
  scene.add.text(152, 404, 'EXPERIMENTS', {
    fontFamily: 'monospace', fontSize: '10px', color: '#6a7d70',
  }).setOrigin(0.5).setDepth(1)
  scene.add.text(400, 545, 'LOBBY  /  01', {
    fontFamily: 'monospace', fontSize: '12px', color: '#687e72',
  }).setOrigin(0.5).setDepth(1)
  const computerHighlight = scene.add.rectangle(COMPUTER.x, COMPUTER.y + 2, 126, 80)
    .setStrokeStyle(2, 0xf3d690).setFillStyle(0xf3d690, 0.08).setDepth(COMPUTER.y + COMPUTER.height / 2 + 1).setVisible(false)
  return { obstacles, computerHighlight }
}
