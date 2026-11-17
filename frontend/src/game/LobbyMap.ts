import Phaser from 'phaser'
import { roomObjects } from './maps/rooms'
import type { RoomId } from './maps/rooms'
import { COMPUTER, WALLS } from './maps/lobbyLayout'
import { ROOM_THEMES, floorData } from './rooms/roomThemes'

export { COMPUTER } from './maps/lobbyLayout'

const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color

/**
 * 방 테마의 바닥·벽과 가구 외형, 공유 맵의 고정 충돌체를 만든다.
 * 가구 위치·충돌 크기는 서버와 공유하므로 바꾸지 않고 텍스처만 방 분위기에 맞게 교체한다.
 * 출입구 문과 장식·이벤트는 `rooms/RoomFx`가 담당한다.
 */
export default function createLobbyMap(scene: Phaser.Scene, roomId: RoomId = 'lobby') {
  const theme = ROOM_THEMES[roomId]
  const objects = roomObjects(roomId)
  const map = scene.make.tilemap({ data: floorData(roomId), tileWidth: 16, tileHeight: 16 })
  const tiles = map.addTilesetImage(`floor-${roomId}`, `floor-${roomId}`, 16, 16)!
  map.createLayer(0, tiles, 0, 0)!.setScale(2).setDepth(-100)

  // 바깥은 벽 대신 하늘·숲 경계를 RoomFx(outdoorFx)가 그린다. 충돌용 벽은 같다.
  if (roomId !== 'outdoor') {
    scene.add.tileSprite(400, 32, 400, 32, `wall-${roomId}`).setScale(2).setDepth(60)
    scene.add.rectangle(12, 320, 24, 560, hex(theme.wall.side)).setDepth(0)
    scene.add.rectangle(788, 320, 24, 560, hex(theme.wall.side)).setDepth(0)
    scene.add.rectangle(400, 588, 800, 24, hex(theme.wall.bottom)).setDepth(0)
    // 벽과 바닥 경계의 그림자로 공간감을 준다.
    scene.add.rectangle(400, 68, 752, 8, 0x000000, 0.18).setDepth(-50)
  }

  const obstacles = scene.physics.add.staticGroup()
  for (const area of [...WALLS, ...objects.map(object => object.body)]) {
    const body = scene.add.rectangle(area.x, area.y, area.width, area.height).setVisible(false)
    obstacles.add(body)
  }
  // 화분은 흔들기 연출을 위해 roomPlants와 같은 순서의 id로 이미지를 돌려준다.
  const plants = new Map<string, Phaser.GameObjects.Image>()
  for (const object of objects) {
    const key = theme.textures[object.texture] ?? object.texture
    // 호수·강처럼 전용 텍스처가 없는 충돌 영역은 방 연출이 직접 그린다.
    if (!scene.textures.exists(key)) continue
    // 가구 아래 접지 그림자
    scene.add.ellipse(object.x, object.bottom - 2, object.body.width * 0.9, 10, 0x000000, 0.18).setDepth(object.bottom - 1)
    const image = scene.add.image(object.x, object.bottom, key).setOrigin(0.5, 1).setScale(2).setDepth(object.bottom)
    if (object.texture === 'plant') plants.set(`${roomId}-plant-${plants.size}`, image)
  }

  // 현재 가까운 상호작용 대상의 크기·위치로 장면이 매 프레임 옮겨 사용한다.
  const interactionHighlight = scene.add.rectangle(COMPUTER.x, COMPUTER.y + 2, 126, 80)
    .setStrokeStyle(2, hex(theme.page.accent)).setFillStyle(hex(theme.page.accent), 0.1)
    .setDepth(COMPUTER.y + COMPUTER.height / 2 + 1).setVisible(false)
  return { obstacles, interactionHighlight, plants }
}
