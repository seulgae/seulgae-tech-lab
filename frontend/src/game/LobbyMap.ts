import Phaser from 'phaser'

// 도형 배치와 충돌체 생성을 장면에서 분리해, 이후 타일맵으로 교체할 위치를 명확히 한다.
export default function createLobbyMap(scene: Phaser.Scene) {
  const { width, height } = scene.scale
  const wallSize = 24

  scene.add.rectangle(width / 2, height / 2, width, height, 0x263238)
  const floor = scene.add.graphics()
  floor.lineStyle(1, 0x37474f, 0.6)
  for (let x = wallSize; x <= width - wallSize; x += 32) {
    floor.lineBetween(x, wallSize, x, height - wallSize)
  }
  for (let y = wallSize; y <= height - wallSize; y += 32) {
    floor.lineBetween(wallSize, y, width - wallSize, y)
  }

  const obstacles = scene.physics.add.staticGroup()
  const blocks = [
    { x: width / 2, y: wallSize / 2, width, height: wallSize, color: 0x607d8b },
    { x: width / 2, y: height - wallSize / 2, width, height: wallSize, color: 0x607d8b },
    { x: wallSize / 2, y: height / 2, width: wallSize, height, color: 0x607d8b },
    { x: width - wallSize / 2, y: height / 2, width: wallSize, height, color: 0x607d8b },
    { x: 400, y: 190, width: 200, height: 64, color: 0x8d6e63 }, // 안내 데스크
    { x: 620, y: 330, width: 112, height: 72, color: 0x546e7a }, // 컴퓨터 책상
  ]

  for (const block of blocks) {
    const rectangle = scene.add.rectangle(block.x, block.y, block.width, block.height, block.color)
    obstacles.add(rectangle) // StaticGroup이 도형과 같은 크기의 고정 충돌체를 생성한다.
  }

  scene.add.text(400, 190, 'INFORMATION', {
    fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff',
  }).setOrigin(0.5)

  // 모니터와 키보드는 책상 위 장식이다. 충돌은 책상 전체 영역 하나로 처리한다.
  scene.add.rectangle(620, 318, 56, 30, 0x101c22)
  scene.add.rectangle(620, 316, 46, 20, 0x80cbc4)
  scene.add.rectangle(620, 350, 42, 8, 0xcfd8dc)
  scene.add.text(620, 278, 'COMPUTER', {
    fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cfd8dc',
  }).setOrigin(0.5)

  return obstacles
}
