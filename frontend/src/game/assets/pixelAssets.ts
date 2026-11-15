import type Phaser from 'phaser'

type Paint = (color: string, x: number, y: number, width: number, height: number) => void
const ink = '#1b292f'
const wood = '#c49a70'
const lightWood = '#e4c49a'
const teal = '#65b3a5'

/** 정수 좌표로만 그린 원본 픽셀 텍스처를 등록한다. 외부 이미지나 폰트를 사용하지 않는다. */
function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (paint: Paint) => void) {
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = false
  draw((color, x, y, w, h) => { context.fillStyle = color; context.fillRect(x, y, w, h) })
  scene.textures.addCanvas(key, canvas)
}

/** 16px 타일과 가구, 16×24 캐릭터 프레임을 같은 팔레트로 생성한다. */
export function createPixelAssets(scene: Phaser.Scene) {
  texture(scene, 'lab-tiles', 48, 16, (p) => {
    for (let frame = 0; frame < 3; frame++) {
      const x = frame * 16
      p(frame === 2 ? '#547e78' : frame ? '#e3dbc4' : '#ddd5bf', x, 0, 16, 16)
      p(frame === 2 ? '#486e68' : '#c9c1ad', x, 15, 16, 1)
      p(frame === 2 ? '#6b9386' : '#ece5d2', x, 0, 16, 1)
      p(frame === 2 ? '#486e68' : '#c9c1ad', x + 15, 0, 1, 16)
      if (frame === 1) p('#d6ceb8', x + 4, 7, 2, 1)
    }
  })
  texture(scene, 'wall', 16, 32, (p) => {
    p('#728a86', 0, 0, 16, 32); p('#c2d3c3', 0, 2, 16, 22)
    p('#e0e6cd', 0, 3, 16, 2); p('#a6bfaf', 15, 3, 1, 21)
    p('#3d6663', 0, 24, 16, 6); p('#274c4e', 0, 30, 16, 2)
    p('#9ab2a4', 0, 23, 16, 1)
  })
  texture(scene, 'reception', 104, 48, (p) => {
    p('#a59d86', 3, 43, 98, 4); p(ink, 1, 13, 102, 30)
    p(wood, 3, 19, 98, 23); p('#977253', 5, 24, 94, 16)
    p('#ad8660', 6, 24, 2, 16); p('#ad8660', 96, 24, 2, 16)
    p(lightWood, 1, 11, 102, 10); p('#f3d8ac', 3, 12, 98, 2)
    p('#6d8d7d', 40, 26, 25, 9); p('#d5e6c9', 44, 29, 17, 2)
    p(ink, 13, 1, 20, 14); p(teal, 15, 3, 16, 9); p('#9ce1be', 17, 5, 8, 1)
    p(ink, 22, 14, 3, 3); p('#e9dfbd', 75, 8, 13, 4); p('#86b7a2', 77, 6, 9, 2)
  })
  texture(scene, 'computer', 64, 64, (p) => {
    p('#aca38c', 5, 60, 54, 3); p(ink, 3, 31, 58, 28)
    p('#8c6d52', 6, 42, 5, 18); p('#8c6d52', 53, 42, 5, 18)
    p(lightWood, 2, 29, 60, 14); p('#f0d5ab', 4, 30, 56, 2)
    p('#233c44', 13, 5, 37, 27); p('#46616a', 15, 6, 33, 24)
    p('#80c2af', 17, 8, 29, 19); p('#b4e2c1', 19, 10, 16, 2)
    p('#437f7c', 20, 15, 4, 2); p('#437f7c', 27, 15, 12, 1); p('#437f7c', 20, 20, 19, 1)
    p('#243d44', 29, 32, 5, 4); p('#41606a', 23, 35, 18, 2)
    p('#edf0d9', 17, 38, 28, 5); p('#859b8d', 19, 39, 24, 2)
    p('#526c6b', 51, 37, 4, 5); p('#719e9b', 6, 17, 5, 13)
  })
  texture(scene, 'chair', 20, 28, (p) => {
    p('#b0a58d', 3, 25, 15, 2); p(ink, 7, 19, 6, 7)
    p('#36565c', 2, 10, 16, 11); p('#5f9390', 3, 11, 14, 7)
    p(ink, 1, 0, 18, 12); p('#537f7c', 3, 1, 14, 10)
    p('#83aaa0', 4, 2, 12, 2); p('#41686a', 3, 8, 14, 3)
    p(ink, 2, 24, 16, 2)
  })
  texture(scene, 'rack', 32, 64, (p) => {
    p('#a69d88', 2, 60, 29, 3); p(ink, 1, 0, 30, 60)
    p('#4a6468', 3, 2, 26, 56); p('#76908b', 4, 2, 24, 2)
    for (let row = 0; row < 5; row++) {
      const y = 7 + row * 9
      p('#263e48', 5, y, 22, 7); p('#64817e', 7, y + 2, 10, 1)
      p('#70c5a2', 22, y + 2, 2, 2); p('#d6b879', 19, y + 2, 1, 2)
    }
    p('#17292f', 5, 54, 22, 2)
  })
  texture(scene, 'equipment', 56, 48, (p) => {
    p('#aaa18c', 3, 44, 50, 3); p(ink, 1, 20, 54, 24)
    p('#68978e', 3, 23, 50, 20); p('#94bbb0', 2, 20, 52, 4)
    p('#d8d9bf', 7, 27, 20, 13); p('#516a6c', 9, 29, 16, 9)
    p('#7ec0ac', 11, 31, 12, 5); p('#d3b97f', 32, 28, 16, 12)
    p('#e5dfbd', 35, 30, 4, 4); p('#526b66', 42, 30, 3, 6)
    p(ink, 6, 4, 16, 16); p('#97cbc0', 8, 6, 12, 11)
    p('#476d6b', 10, 10, 8, 1); p('#d9e6c7', 35, 7, 6, 13)
    p('#80baad', 35, 13, 6, 7); p('#426d68', 34, 5, 8, 3)
    p('#d9e6c7', 45, 12, 5, 8); p('#d8b976', 45, 16, 5, 4)
  })
  texture(scene, 'plant', 24, 40, (p) => {
    p('#aaa18a', 4, 37, 17, 2); p(ink, 5, 26, 15, 11)
    p('#b8865d', 6, 26, 13, 10); p('#dbb184', 5, 25, 15, 3)
    p('#476e51', 11, 10, 3, 16); p('#4e845e', 2, 13, 9, 7)
    p('#73a570', 4, 12, 8, 5); p('#356c53', 14, 6, 9, 9)
    p('#78ab76', 14, 6, 7, 5); p('#4f8c61', 8, 0, 8, 12)
    p('#92ba7b', 9, 1, 4, 7); p('#74a36a', 13, 18, 9, 5)
  })
  texture(scene, 'door', 48, 40, (p) => {
    p('#254b50', 0, 0, 48, 40); p('#91aaa0', 2, 2, 44, 36)
    p('#263e48', 5, 4, 38, 34); p('#547c7c', 7, 6, 34, 30)
    p('#91c2b4', 9, 8, 30, 15); p('#aecfbd', 10, 9, 7, 12)
    p('#355c62', 23, 5, 2, 32); p('#d7c28a', 19, 27, 2, 4)
  })
  createResearcher(scene)
}

/** 4방향의 걷기·대기 8행에 각각 4프레임을 배치한 스프라이트 시트를 생성한다. */
function createResearcher(scene: Phaser.Scene) {
  if (scene.textures.exists('researcher')) return
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 192
  const context = canvas.getContext('2d')!
  for (let row = 0; row < 8; row++) {
    for (let frame = 0; frame < 4; frame++) {
      const facing = row % 4
      const walking = row < 4
      const step = walking ? [0, 1, 0, -1][frame]! : 0
      const bob = walking && frame % 2 ? -1 : (!walking && frame === 2 ? -1 : 0)
      const p: Paint = (color, x, y, w, h) => { context.fillStyle = color; context.fillRect(frame * 16 + x, row * 24 + y, w, h) }
      p('#253e48', 4, 19, 3, 4 + step); p('#253e48', 9, 19, 3, 4 - step)
      p('#132d38', 3, 22 + Math.min(step, 0), 4, 2); p('#132d38', 9, 22 - Math.max(step, 0), 4, 2)
      p('#38595c', 3, 10 + bob, 10, 10); p('#f2ead1', 4, 10 + bob, 8, 9)
      p('#d7d9c2', 4, 17 + bob, 8, 3); p('#619a96', 7, 11 + bob, 2, 7)
      p('#edd3a7', 2, 12 + bob + Math.min(step, 0), 2, 5); p('#edd3a7', 12, 12 + bob - Math.max(step, 0), 2, 5)
      p('#2c4147', 4, 1 + bob, 8, 9); p('#edc99b', 5, 4 + bob, 6, 6)
      p('#553f38', 4, 1 + bob, 8, 4); p('#78554a', 5, 1 + bob, 6, 1)
      if (facing === 1) { p('#553f38', 4, 3 + bob, 8, 7); p('#d7d9c2', 6, 10 + bob, 4, 2) }
      else if (facing === 2) { p('#553f38', 8, 3 + bob, 4, 6); p('#1d3941', 4, 6 + bob, 2, 1); p('#f2d7ac', 3, 7 + bob, 2, 2) }
      else if (facing === 3) { p('#553f38', 4, 3 + bob, 4, 6); p('#1d3941', 10, 6 + bob, 2, 1); p('#f2d7ac', 11, 7 + bob, 2, 2) }
      else { p('#1d3941', 5, 6 + bob, 2, 1); p('#1d3941', 9, 6 + bob, 2, 1); p('#b37c62', 7, 9 + bob, 2, 1) }
      if (facing !== 1) p('#d9b76f', 10, 12 + bob, 1, 2)
    }
  }
  const sheet = scene.textures.addCanvas('researcher', canvas)!
  scene.textures.addSpriteSheet('researcher', sheet, { frameWidth: 16, frameHeight: 24 })
}
