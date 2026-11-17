import type Phaser from 'phaser'
import { texture } from './pixelAssets.ts'
import type { Paint } from './pixelAssets.ts'
import { ROOM_THEMES } from '../rooms/roomThemes.ts'
import { SKY_PALETTES, SKY_PHASES } from '../rooms/timeOfDay.ts'
import type { RoomId } from '../maps/rooms.ts'

const ink = '#15100d'

/**
 * 방별 바닥·벽·문과 분위기 가구, 조명·파티클용 텍스처를 등록한다.
 * 기존 공용 텍스처와 마찬가지로 정수 좌표 fillRect만 사용한다.
 */
export function createRoomAssets(scene: Phaser.Scene) {
  for (const roomId of Object.keys(ROOM_THEMES) as RoomId[]) {
    floor(scene, roomId)
    wall(scene, roomId)
    door(scene, roomId)
  }
  lobbyFurniture(scene)
  devFurniture(scene)
  meetingFurniture(scene)
  serverFurniture(scene)
  controlFurniture(scene)
  outdoorScenery(scene)
  effects(scene)
}

function floor(scene: Phaser.Scene, roomId: RoomId) {
  const f = ROOM_THEMES[roomId].floor
  texture(scene, `floor-${roomId}`, 48, 16, p => {
    for (let frame = 0; frame < 3; frame++) {
      const x = frame * 16
      const fill = frame === 0 ? f.base : frame === 1 ? f.alt : f.accent
      const line = frame === 0 ? f.baseLine : frame === 1 ? f.altLine : f.accentLine
      p(fill, x, 0, 16, 16)
      if (roomId === 'lobby') {
        if (frame < 2) {
          // 대리석 결: 짧은 사선 무늬와 얇은 줄눈
          p(line, x + 15, 0, 1, 16); p(line, x, 15, 16, 1)
          for (let i = 0; i < 4; i++) p(line, x + 3 + i * 2 + frame, 3 + i * 2, 2, 1)
          p('#fffaf0', x + 1, 1, 3, 1)
        } else {
          p(line, x, 0, 16, 1); p(line, x, 15, 16, 1)
          p(f.accentDetail, x + 7, 5, 2, 1); p(f.accentDetail, x + 6, 6, 4, 1); p(f.accentDetail, x + 7, 7, 2, 1)
          p('#a3404a', x + 2, 11, 12, 1)
        }
      } else if (roomId === 'development-lab') {
        if (frame === 0) { p(line, x + 15, 0, 1, 16); p(line, x, 15, 16, 1); p('#22304a', x + 8, 8, 1, 1) }
        else if (frame === 1) { p(line, x, 0, 16, 1); p(line, x, 0, 1, 16); p('#2a6f93', x, 0, 2, 2) }
        else {
          p(line, x, 0, 16, 16); p(fill, x + 1, 1, 14, 14)
          for (let i = 0; i < 16; i += 4) { p(f.accentDetail, x + i, 7, 2, 2); p(f.accentDetail, x + 7, i, 2, 2) }
        }
      } else if (roomId === 'control-room') {
        // 정전기 방지 고무 타일: 원형 돌기와 앰버 안전선
        if (frame < 2) {
          p(line, x + 15, 0, 1, 16); p(line, x, 15, 16, 1)
          for (let yy = 3; yy < 15; yy += 5) for (let xx = 3; xx < 15; xx += 5) p(frame ? '#252e36' : '#222a31', x + xx, yy, 2, 2)
        } else {
          p(line, x, 0, 16, 16); p(fill, x, 3, 16, 10)
          for (let i = 0; i < 16; i += 6) p(f.accentDetail, x + i, 6, 3, 4)
        }
      } else if (roomId === 'outdoor') {
        if (frame < 2) {
          // 풀잎과 작은 꽃
          p(line, x + 2, 3, 1, 2); p(line, x + 9, 1, 1, 3); p(line, x + 13, 9, 1, 2); p(line, x + 5, 11, 1, 3)
          p('#8fca70', x + 7, 6, 1, 2); p('#8fca70', x + 11, 13, 1, 2)
          if (frame === 1) { p('#fff6c9', x + 4, 7, 2, 2); p('#f2d04a', x + 4, 7, 1, 1); p('#f6a5c0', x + 12, 3, 2, 2) }
        } else {
          // 흙길: 자갈과 바퀴 자국
          p(line, x, 0, 16, 1); p(line, x + 3, 5, 3, 1); p(line, x + 10, 10, 4, 1)
          p(f.accentDetail, x + 6, 2, 2, 2); p(f.accentDetail, x + 12, 6, 1, 1); p(f.accentDetail, x + 2, 12, 2, 1)
        }
      } else if (roomId === 'server-room') {
        // 이중 바닥 패널: 테두리와 모서리 볼트
        p(line, x, 0, 16, 1); p(line, x, 15, 16, 1); p(line, x, 0, 1, 16); p(line, x + 15, 0, 1, 16)
        if (frame < 2) { p('#56677a', x + 2, 2, 1, 1); p('#56677a', x + 13, 2, 1, 1); p('#56677a', x + 2, 13, 1, 1); p('#56677a', x + 13, 13, 1, 1) }
        if (frame === 1) p('#4a5868', x + 1, 1, 14, 1)
        if (frame === 2) for (let yy = 3; yy < 14; yy += 3) for (let xx = 3; xx < 14; xx += 3) p(f.accentDetail, x + xx, yy, 1, 1)
      } else {
        if (frame < 2) {
          // 엇갈린 원목 마루 판
          p(line, x, 5, 16, 1); p(line, x, 10, 16, 1); p(line, x, 15, 16, 1)
          p(line, x + (frame ? 4 : 11), 0, 1, 5); p(line, x + (frame ? 12 : 6), 6, 1, 4); p(line, x + (frame ? 7 : 2), 11, 1, 4)
          p('#d6a674', x + 2, 2, 4, 1)
        } else {
          for (let yy = 2; yy < 16; yy += 4) for (let xx = (yy % 8 === 2 ? 2 : 4); xx < 16; xx += 4) p(f.accentDetail, x + xx, yy, 1, 1)
        }
      }
    }
  })
}

function wall(scene: Phaser.Scene, roomId: RoomId) {
  const w = ROOM_THEMES[roomId].wall
  texture(scene, `wall-${roomId}`, 16, 32, p => {
    p(w.upper, 0, 0, 16, 22); p(w.upperLight, 0, 2, 16, 2)
    p(w.trim, 0, 21, 16, 2)
    p(w.lower, 0, 23, 16, 7); p(w.lowerDark, 0, 30, 16, 2)
    if (roomId === 'lobby') {
      // 금색 몰딩과 원목 웨인스코팅 패널
      p(w.trim, 0, 0, 16, 1); p(w.detail, 2, 24, 12, 1); p(w.detail, 2, 28, 12, 1); p(w.detail, 2, 24, 1, 5); p(w.detail, 13, 24, 1, 5)
      p('#e8d6b2', 7, 6, 2, 12)
    } else if (roomId === 'development-lab') {
      p(w.upperLight, 0, 10, 16, 1); p(w.detail, 3, 14, 1, 1); p(w.detail, 11, 7, 1, 1)
      p('#7ff5d2', 0, 22, 16, 1)
    } else if (roomId === 'control-room') {
      // 흡음 패널과 초록 상태 표시줄
      p(w.upperLight, 0, 6, 16, 1); p(w.upperLight, 0, 14, 16, 1); p(w.lowerDark, 7, 0, 1, 21)
      p(w.detail, 0, 22, 16, 1); p(w.trim, 2, 26, 3, 2)
    } else if (roomId === 'server-room') {
      // 하단 경고 줄무늬
      for (let i = 0; i < 16; i += 4) { p(w.trim, i, 24, 2, 6) }
      p(w.upperLight, 0, 8, 16, 1); p(w.upperLight, 0, 15, 16, 1); p(w.detail, 13, 4, 1, 1)
    } else {
      p(w.detail, 1, 25, 6, 4); p(w.detail, 9, 25, 6, 4); p(w.lowerDark, 0, 23, 16, 1)
      p('#e6d6bb', 0, 12, 16, 1)
    }
  })
}

function door(scene: Phaser.Scene, roomId: RoomId) {
  const d = ROOM_THEMES[roomId].door
  // 문틀(48×40)의 개구부 x 6~41, y 6~39에 문짝 두 장(각 18×34)이 들어간다.
  texture(scene, `door-frame-${roomId}`, 48, 40, p => {
    p(d.frame, 0, 0, 48, 40); p(d.frameLight, 2, 2, 44, 2); p(d.frameLight, 2, 2, 2, 38); p(d.frameLight, 44, 2, 2, 38)
    p('#07090b', 6, 6, 36, 34)
    p(d.sign, 18, 0, 12, 3)
  })
  texture(scene, `door-panel-${roomId}`, 18, 34, p => {
    p(d.panel, 0, 0, 18, 34); p(d.panelLight, 1, 1, 16, 2); p(d.panelLight, 1, 1, 2, 32)
    p(ink, 17, 0, 1, 34)
    if (roomId === 'development-lab' || roomId === 'server-room' || roomId === 'control-room') { p('#a9d8ff', 4, 5, 10, 12); p('#d9f0ff', 5, 6, 3, 10) }
    else { p(d.panelLight, 4, 6, 10, 9); p(d.panel, 5, 7, 8, 7); p(d.panelLight, 4, 19, 10, 10); p(d.panel, 5, 20, 8, 8) }
    p(d.handle, 14, 17, 2, 4)
  })
}

function lobbyFurniture(scene: Phaser.Scene) {
  texture(scene, 'lobby-desk', 104, 48, p => {
    p('#2a1a12', 3, 43, 98, 4); p(ink, 1, 13, 102, 30)
    p('#5a3a2a', 3, 19, 98, 23); p('#46291c', 5, 24, 94, 16)
    for (let x = 12; x < 96; x += 16) p('#c9a24b', x, 26, 1, 12)
    p('#c9a24b', 3, 19, 98, 1); p('#efe6d6', 1, 11, 102, 9); p('#fffaf0', 3, 12, 98, 2); p('#d9cdb7', 30, 15, 20, 1)
    p('#c9a24b', 42, 28, 20, 8); p('#3b2418', 44, 30, 16, 4)
    // 호출 벨과 스탠드 조명, 꽃병
    p('#e7c66f', 72, 7, 8, 4); p('#c9a24b', 71, 10, 10, 1); p('#fff2b8', 75, 5, 2, 2)
    p('#2c3a34', 16, 1, 2, 10); p('#ffe9a8', 11, 0, 12, 4); p('#c9a24b', 13, 10, 8, 1)
    p('#8c2f39', 90, 4, 4, 7); p('#e05a6c', 88, 1, 3, 3); p('#f08a5d', 93, 0, 3, 3); p('#6b9a62', 91, 2, 2, 3)
  })
  texture(scene, 'bookshelf', 32, 64, p => {
    p('#2a1a12', 2, 60, 29, 3); p(ink, 1, 0, 30, 60); p('#5a3a2a', 3, 2, 26, 56); p('#c9a24b', 3, 2, 26, 1)
    const books = ['#8c2f39', '#3f6b8f', '#c9a24b', '#4f7a5a', '#e8d6b2', '#7a4b8f']
    for (let shelf = 0; shelf < 4; shelf++) {
      const y = 5 + shelf * 13
      p('#3b2418', 4, y + 10, 24, 2)
      for (let i = 0; i < 6; i++) p(books[(i + shelf * 2) % books.length]!, 5 + i * 4, y + (i % 3), 3, 10 - (i % 3))
    }
  })
  texture(scene, 'lounge-sofa', 56, 48, p => {
    p('#2a1a12', 3, 44, 50, 3); p(ink, 2, 18, 52, 26)
    p('#8c2f39', 4, 18, 48, 12); p('#a3404a', 6, 19, 44, 3)
    p('#6e2129', 3, 28, 50, 14); p('#8c2f39', 6, 30, 21, 8); p('#8c2f39', 29, 30, 21, 8)
    p('#a3404a', 7, 30, 19, 2); p('#a3404a', 30, 30, 19, 2)
    p('#3b2418', 6, 42, 3, 3); p('#3b2418', 47, 42, 3, 3)
    p('#c9a24b', 10, 22, 8, 5); p('#e7c66f', 11, 23, 6, 3); p('#c9a24b', 38, 22, 8, 5); p('#e7c66f', 39, 23, 6, 3)
  })
  texture(scene, 'armchair', 20, 28, p => {
    p('#2a1a12', 3, 25, 15, 2); p(ink, 1, 2, 18, 22)
    p('#8c2f39', 2, 3, 16, 10); p('#a3404a', 4, 4, 12, 3)
    p('#6e2129', 1, 12, 18, 10); p('#8c2f39', 4, 13, 12, 6)
    p('#c9a24b', 3, 22, 2, 3); p('#c9a24b', 15, 22, 2, 3)
  })
  texture(scene, 'kiosk', 64, 64, p => {
    p('#2a1a12', 5, 60, 54, 3); p(ink, 3, 31, 58, 28)
    p('#5a3a2a', 4, 33, 56, 25); p('#c9a24b', 4, 33, 56, 1); p('#46291c', 8, 38, 48, 16)
    p('#efe6d6', 2, 29, 60, 5); p('#fffaf0', 4, 30, 56, 1)
    p('#2a1a12', 12, 2, 40, 28); p('#c9a24b', 13, 3, 38, 26); p('#1e2a2b', 15, 5, 34, 22)
    p('#ffd89a', 17, 7, 30, 3); p('#e8d6b2', 17, 13, 22, 1); p('#e8d6b2', 17, 17, 26, 1); p('#e8d6b2', 17, 21, 16, 1)
    p('#c9a24b', 29, 30, 6, 3); p('#8c2f39', 26, 44, 12, 6); p('#e7c66f', 28, 46, 8, 2)
  })
  texture(scene, 'tall-plant', 24, 40, p => {
    p('#2a1a12', 4, 37, 17, 2); p(ink, 5, 26, 15, 11); p('#c9a24b', 6, 26, 13, 10); p('#e7c66f', 5, 25, 15, 3)
    p('#356c53', 11, 6, 3, 20); p('#3f7d4f', 1, 10, 10, 8); p('#5f9c5e', 3, 9, 8, 5)
    p('#2e5e46', 14, 3, 10, 10); p('#6fac67', 14, 4, 7, 5); p('#4f8c61', 7, 0, 9, 12); p('#8fc27a', 8, 1, 4, 7); p('#5f9c5e', 13, 16, 10, 6)
  })
  // 유리(x 2~37, y 2~21)는 비워 두고 뒤에 시간대별 하늘(sky-*)을 깐다. 건물 실루엣과 창틀만 그린다.
  texture(scene, 'lobby-window', 40, 24, p => {
    p('#3b2418', 0, 0, 40, 2); p('#3b2418', 0, 22, 40, 2); p('#3b2418', 0, 0, 2, 24); p('#3b2418', 38, 0, 2, 24)
    p('#c9a24b', 1, 1, 38, 1)
    p('#34465a', 4, 13, 6, 9); p('#2a3a4c', 11, 9, 5, 13); p('#3d5168', 17, 15, 7, 7); p('#2a3a4c', 25, 11, 4, 11); p('#34465a', 30, 14, 7, 8)
    p('#ffd98a', 12, 12, 1, 1); p('#ffd98a', 14, 16, 1, 1); p('#ffd98a', 26, 14, 1, 1); p('#ffd98a', 6, 16, 1, 1); p('#ffd98a', 32, 17, 1, 1)
    p('#3b2418', 19, 2, 2, 20); p('#3b2418', 2, 11, 36, 1)
  })
  texture(scene, 'lobby-board', 64, 20, p => {
    p('#3b2418', 0, 0, 64, 20); p('#c9a24b', 1, 1, 62, 18); p('#1a1410', 2, 2, 60, 16)
  })
  texture(scene, 'chandelier', 32, 20, p => {
    p('#c9a24b', 15, 0, 2, 6); p('#c9a24b', 4, 6, 24, 2); p('#e7c66f', 6, 8, 20, 1)
    for (const x of [4, 10, 16, 22, 26]) { p('#c9a24b', x, 8, 2, 5); p('#fff2b8', x, 13, 2, 3); p('#ffffff', x, 13, 1, 1) }
    p('#e7c66f', 12, 15, 8, 3); p('#fff2b8', 14, 18, 4, 2)
  })
}

function devFurniture(scene: Phaser.Scene) {
  texture(scene, 'dev-desk', 64, 64, p => {
    p('#05080d', 5, 60, 54, 3); p(ink, 3, 31, 58, 28)
    p('#1b2538', 4, 33, 56, 25); p('#0f1522', 8, 40, 5, 18); p('#0f1522', 51, 40, 5, 18)
    p('#26344d', 2, 29, 60, 6); p('#39e6b4', 2, 34, 60, 1)
    // 듀얼 모니터
    for (const mx of [6, 33]) { p('#05080d', mx, 5, 26, 21); p('#0c2a2a', mx + 2, 7, 22, 16); p('#39e6b4', mx + 4, 9, 10, 1); p('#38bdf8', mx + 4, 12, 15, 1); p('#39e6b4', mx + 6, 15, 8, 1); p('#c084fc', mx + 4, 18, 12, 1); p('#05080d', mx + 11, 26, 4, 3) }
    // RGB 키보드와 머그컵
    p('#05080d', 15, 30, 30, 4); p('#39e6b4', 17, 31, 8, 1); p('#38bdf8', 25, 31, 8, 1); p('#c084fc', 33, 31, 9, 1)
    p('#e2e8f0', 49, 27, 5, 5); p('#94a3b8', 54, 28, 1, 3)
  })
  texture(scene, 'gaming-chair', 20, 28, p => {
    p('#05080d', 3, 25, 15, 2); p(ink, 7, 19, 6, 7)
    p('#111827', 2, 10, 16, 11); p('#1f2937', 3, 11, 14, 7)
    p(ink, 1, 0, 18, 12); p('#111827', 3, 1, 14, 10); p('#39e6b4', 3, 1, 1, 10); p('#39e6b4', 16, 1, 1, 10); p('#39e6b4', 7, 3, 6, 1)
    p(ink, 2, 24, 16, 2)
  })
  texture(scene, 'workbench', 56, 48, p => {
    p('#05080d', 3, 44, 50, 3); p(ink, 1, 20, 54, 24)
    p('#1b2538', 3, 23, 50, 20); p('#26344d', 2, 20, 52, 4); p('#39e6b4', 2, 23, 52, 1)
    // 오실로스코프와 3D 프린터
    p('#05080d', 5, 4, 22, 17); p('#062a22', 7, 6, 18, 11)
    for (let x = 0; x < 16; x++) p('#39e6b4', 8 + x, 11 + [0, -2, -3, -2, 0, 2, 3, 2][x % 8]!, 1, 1)
    p('#e2e8f0', 32, 2, 18, 19); p('#0f1522', 34, 4, 14, 13); p('#f97316', 39, 12, 4, 3); p('#94a3b8', 35, 8, 12, 1)
    p('#38bdf8', 8, 30, 3, 3); p('#39e6b4', 14, 30, 3, 3); p('#c084fc', 20, 30, 3, 3)
  })
  texture(scene, 'dev-screen', 96, 26, p => {
    p('#05080d', 0, 0, 96, 26); p('#38bdf8', 1, 1, 94, 1); p('#38bdf8', 1, 24, 94, 1); p('#071420', 2, 2, 92, 22)
  })
}

function meetingFurniture(scene: Phaser.Scene) {
  // 세로로 긴 원목 회의 테이블(52×128 → 104×256, 충돌 96×240): 상판 나뭇결, 서류와 커피잔
  texture(scene, 'meeting-table-long', 52, 128, p => {
    p('#2a1a12', 4, 122, 44, 5); p(ink, 1, 6, 50, 116)
    p('#a87a52', 3, 8, 46, 104); p('#c4966a', 4, 9, 44, 2); p('#8a5a36', 3, 108, 46, 6)
    for (let y = 18; y < 106; y += 14) p('#9c6c45', 6, y, 40, 1)
    p('#5f3d24', 5, 114, 4, 8); p('#5f3d24', 43, 114, 4, 8)
    p('#f4efe6', 10, 30, 12, 15); p('#d9cdb7', 12, 33, 8, 1); p('#d9cdb7', 12, 36, 8, 1)
    p('#f4efe6', 30, 70, 12, 15); p('#d9cdb7', 32, 73, 8, 1); p('#d9cdb7', 32, 76, 8, 1)
    p('#ffffff', 23, 13, 6, 5); p('#6f4628', 24, 14, 4, 2); p('#ffffff', 23, 83, 6, 5); p('#6f4628', 24, 84, 4, 2)
    p('#4f7a5a', 22, 50, 8, 8); p('#6c9775', 23, 51, 6, 3)
  })
  texture(scene, 'meeting-table', 104, 48, p => {
    p('#5f3d24', 3, 43, 98, 4); p(ink, 1, 13, 102, 30)
    p('#8a5a36', 3, 19, 98, 23); p('#6f4628', 8, 22, 4, 20); p('#6f4628', 92, 22, 4, 20)
    p('#c99463', 1, 9, 102, 12); p('#dcae7c', 3, 10, 98, 2); p('#b98252', 3, 15, 98, 1)
    // 노트북, 서류, 커피잔
    p('#cbd5e1', 14, 4, 18, 8); p('#334155', 15, 5, 16, 6); p('#94a3b8', 12, 12, 22, 2)
    p('#cbd5e1', 70, 4, 18, 8); p('#334155', 71, 5, 16, 6); p('#94a3b8', 68, 12, 22, 2)
    p('#f8f5ef', 44, 11, 14, 6); p('#cbd5e1', 46, 13, 10, 1)
    p('#f8f5ef', 38, 8, 5, 5); p('#6f4628', 39, 9, 3, 2); p('#f8f5ef', 62, 8, 5, 5); p('#6f4628', 63, 9, 3, 2)
  })
  texture(scene, 'office-chair', 20, 28, p => {
    p('#5f3d24', 3, 25, 15, 2); p(ink, 7, 19, 6, 7)
    p('#43694d', 2, 10, 16, 11); p('#6c9775', 3, 11, 14, 7)
    p(ink, 1, 0, 18, 12); p('#4f7a5a', 3, 1, 14, 10); p('#8fb996', 4, 2, 12, 3)
    p(ink, 2, 24, 16, 2)
  })
  texture(scene, 'whiteboard', 56, 48, p => {
    p('#5f3d24', 3, 44, 50, 3); p('#94a3b8', 8, 30, 2, 14); p('#94a3b8', 46, 30, 2, 14)
    p('#64748b', 1, 2, 54, 30); p('#f8fafc', 3, 4, 50, 26); p('#e2e8f0', 3, 27, 50, 3)
    p('#ef4444', 6, 28, 5, 1); p('#3b82f6', 13, 28, 5, 1); p('#22c55e', 20, 28, 5, 1)
  })
  texture(scene, 'meeting-window', 40, 24, p => {
    p('#5f3d24', 0, 0, 40, 2); p('#5f3d24', 0, 22, 40, 2); p('#5f3d24', 0, 0, 2, 24); p('#5f3d24', 38, 0, 2, 24)
    p('#d9c4a0', 1, 1, 38, 1)
    p('#3f6b4a', 2, 15, 12, 7); p('#2f5a3c', 6, 12, 6, 4); p('#4f7a5a', 26, 14, 12, 8); p('#2f5a3c', 30, 11, 5, 4)
    p('#5f3d24', 19, 2, 2, 20)
  })
  // 창문 유리 크기(36×20)의 시간대별 하늘
  for (const phase of SKY_PHASES) {
    const sky = SKY_PALETTES[phase]
    texture(scene, `sky-${phase}`, 36, 20, p => {
      p(sky.top, 0, 0, 36, 7); p(sky.middle, 0, 7, 36, 7); p(sky.horizon, 0, 14, 36, 6)
      p(sky.middle, 0, 6, 36, 1); p(sky.horizon, 0, 13, 36, 1)
      for (let i = 0; i < sky.stars; i++) p('#ffffff', (i * 13 + 5) % 34 + 1, (i * 7 + 2) % 10 + 1, 1, 1)
      if (sky.sun) { const { x, y, color } = sky.sun; p(color, x, y, 4, 4); p(color, x - 1, y + 1, 6, 2); p(color, x + 1, y - 1, 2, 6) }
      if (sky.moon) { const { x, y } = sky.moon; p('#f4f1d0', x, y, 3, 4); p('#f4f1d0', x - 1, y + 1, 1, 2); p(sky.top, x + 1, y, 2, 2) }
    })
  }
  texture(scene, 'meeting-sign', 32, 10, p => {
    p('#2a1d14', 0, 0, 32, 10); p('#5f3d24', 1, 1, 30, 8)
  })
}

function serverFurniture(scene: Phaser.Scene) {
  texture(scene, 'server-rack', 32, 64, p => {
    p('#07090b', 2, 60, 29, 3); p(ink, 1, 0, 30, 60)
    p('#1c232c', 3, 2, 26, 56); p('#3a4654', 4, 2, 24, 1)
    for (let row = 0; row < 6; row++) {
      const y = 6 + row * 8
      p('#0d1116', 5, y, 22, 6)
      for (let x = 7; x < 19; x += 2) p('#27313d', x, y + 1, 1, 4)
      p('#5fb6ff', 21, y + 1, 1, 1); p('#22c55e', 23, y + 1, 1, 1); p('#22c55e', 25, y + 1, 1, 1)
    }
    p('#e2b33c', 5, 54, 22, 1); p('#0d1116', 5, 55, 22, 2)
  })
  texture(scene, 'cooling-unit', 56, 48, p => {
    p('#07090b', 3, 44, 50, 3); p(ink, 1, 6, 54, 38)
    p('#cbd5e1', 3, 8, 50, 35); p('#e2e8f0', 3, 8, 50, 2)
    // 팬 그릴과 상태 표시창
    p('#475569', 7, 14, 22, 22); p('#1e293b', 9, 16, 18, 18)
    for (let i = 0; i < 18; i += 3) p('#64748b', 9, 16 + i, 18, 1)
    p('#94a3b8', 16, 23, 4, 4)
    p('#0d1116', 33, 14, 16, 9); p('#5fb6ff', 35, 16, 9, 2); p('#a9d8ff', 35, 19, 5, 1)
    p('#22c55e', 33, 27, 3, 3); p('#e2b33c', 38, 27, 3, 3)
    for (let x = 33; x < 50; x += 3) p('#94a3b8', x, 33, 2, 7)
  })
  texture(scene, 'alarm-light', 12, 10, p => {
    p('#0d1116', 0, 7, 12, 3); p('#7f1d1d', 2, 1, 8, 7); p('#ef4444', 3, 2, 6, 5); p('#fecaca', 4, 3, 2, 2)
  })
  texture(scene, 'server-sign', 40, 10, p => {
    p('#0d1116', 0, 0, 40, 10); p('#e2b33c', 1, 1, 38, 1); p('#e2b33c', 1, 8, 38, 1)
  })
}

/**
 * 관제실 화면 영역(텍스처 좌표). 모니터 월(280×64)을 2배로 그리므로 월드 좌표는
 * x = 120 + tx·2, y = 40 + ty·2 (공유 맵의 모니터 월: 중심 400, 바닥 168)이다. RoomFx가 이 위에 실시간 화면을 그린다.
 */
export const MONITOR_SCREENS = [0, 1, 2, 3, 4, 5].map(index => ({ x: 4 + (index % 3) * 93, y: 5 + Math.floor(index / 3) * 30, width: 86, height: 26 }))

function controlFurniture(scene: Phaser.Scene) {
  texture(scene, 'monitor-wall', 280, 64, p => {
    p('#05070a', 0, 0, 280, 64); p('#1b232b', 1, 1, 278, 62); p('#2a343e', 1, 1, 278, 1)
    for (const s of MONITOR_SCREENS) {
      p('#05070a', s.x - 1, s.y - 1, s.width + 2, s.height + 2)
      p('#0b1a12', s.x, s.y, s.width, s.height)
      p('#ff4d4d', s.x + s.width - 4, s.y + 2, 2, 2)
    }
    // 아래 받침과 케이블 덕트
    p('#11171d', 0, 60, 280, 4); p('#ffb547', 6, 61, 12, 1); p('#4ade80', 262, 61, 12, 1)
  })
  texture(scene, 'control-console', 120, 44, p => {
    p('#05070a', 2, 40, 116, 4); p(ink, 0, 10, 120, 30)
    p('#2a343e', 2, 12, 116, 6); p('#1b232b', 2, 18, 116, 20)
    // 작은 모니터 세 대와 키보드, 버튼
    for (const x of [14, 50, 86]) { p('#05070a', x, 0, 20, 13); p('#13261b', x + 1, 1, 18, 10); p('#4ade80', x + 3, 4, 8, 1); p('#ffb547', x + 3, 7, 12, 1); p('#2a343e', x + 8, 13, 4, 2) }
    for (const x of [10, 46, 82]) { p('#3b4752', x, 20, 26, 6); for (let i = 0; i < 6; i++) p('#56636f', x + 2 + i * 4, 21, 3, 2) }
    for (let i = 0; i < 8; i++) p(i % 3 ? '#4ade80' : '#ffb547', 12 + i * 13, 30, 3, 3)
    p('#ffb547', 2, 12, 116, 1)
  })
  texture(scene, 'operator-chair', 20, 28, p => {
    p('#05070a', 4, 25, 12, 3); p('#2a343e', 9, 18, 2, 7)
    p(ink, 2, 2, 16, 18); p('#3b4752', 3, 3, 14, 16); p('#ffb547', 3, 3, 14, 1); p('#56636f', 5, 6, 10, 9)
  })
  texture(scene, 'control-rack', 32, 64, p => {
    p('#05070a', 2, 60, 29, 3); p(ink, 1, 0, 30, 60); p('#1b232b', 3, 2, 26, 56)
    for (let row = 0; row < 7; row++) {
      p('#2a343e', 5, 5 + row * 8, 22, 6)
      p(row % 2 ? '#4ade80' : '#ffb547', 7, 7 + row * 8, 2, 2); p('#4ade80', 11, 7 + row * 8, 2, 2)
    }
  })
}

/** 바깥 초원의 나무(그루터기 중심이 충돌 영역)와 바위 */
function outdoorScenery(scene: Phaser.Scene) {
  texture(scene, 'oak-tree', 48, 64, p => {
    // 수관: 짙은 테두리 → 중간 → 밝은 잎
    p('#1f4a22', 6, 4, 36, 40); p('#1f4a22', 2, 12, 44, 24); p('#1f4a22', 12, 0, 24, 48)
    p('#2f6b30', 8, 6, 32, 36); p('#2f6b30', 4, 14, 40, 20)
    p('#3f8a3c', 10, 8, 22, 18); p('#3f8a3c', 26, 20, 14, 12)
    p('#5aa84f', 14, 10, 10, 6); p('#5aa84f', 30, 22, 6, 4); p('#5aa84f', 8, 18, 6, 4)
    // 줄기와 뿌리
    p('#3b2418', 20, 42, 8, 18); p('#5a3a2a', 22, 42, 3, 18); p('#3b2418', 16, 58, 16, 4)
  })
  texture(scene, 'field-rock', 18, 12, p => {
    p('#4b5560', 1, 3, 16, 9); p('#4b5560', 3, 1, 12, 11)
    p('#6c7784', 3, 2, 10, 6); p('#8f9aa6', 5, 3, 4, 2); p('#3a424b', 2, 10, 14, 2)
  })
  // 낚시 찌·물고기·느낌표 아이콘(미니게임)과 반딧불이
  texture(scene, 'bobber', 6, 8, p => { p('#f2f2f2', 1, 0, 4, 4); p('#e23d3d', 1, 4, 4, 3); p('#3b2418', 2, 7, 2, 1) })
  texture(scene, 'fish', 14, 8, p => {
    p('#ffffff', 2, 2, 9, 4); p('#ffffff', 4, 1, 5, 6); p('#ffffff', 11, 1, 3, 2); p('#ffffff', 11, 5, 3, 2); p('#ffffff', 11, 3, 2, 2)
    p('#1b1b1b', 4, 3, 1, 1)
  })
  texture(scene, 'exclaim', 6, 12, p => { p('#ffd23f', 2, 0, 3, 8); p('#ffd23f', 2, 9, 3, 3); p('#3b2418', 1, 0, 1, 8) })
}

function effects(scene: Phaser.Scene) {
  // 계단식 픽셀 원형 조명. 색은 사용하는 쪽에서 tint로 바꾼다.
  texture(scene, 'glow', 32, 32, p => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5) / 16
      if (d >= 1) continue
      const alpha = Math.round((1 - d) ** 2 * 4) / 4
      if (alpha > 0) p(`rgba(255,255,255,${alpha})`, x, y, 1, 1)
    }
  })
  texture(scene, 'spark', 3, 3, (p: Paint) => { p('#ffffff', 1, 0, 1, 3); p('#ffffff', 0, 1, 3, 1) })
  texture(scene, 'dot', 2, 2, p => p('#ffffff', 0, 0, 2, 2))
  // 로비 데스크 위 커피 머신과 케이크, 먹고 마실 때 머리 위에 뜨는 아이콘, 책장에서 꺼내는 책(tint로 색 변주)
  texture(scene, 'coffee-machine', 16, 20, p => {
    p('#1f1a17', 1, 0, 14, 18); p('#3d332d', 2, 1, 12, 6); p('#c9a24b', 3, 2, 3, 1); p('#7fd0a8', 10, 2, 2, 2)
    p('#2a2320', 3, 8, 10, 3); p('#0f0c0b', 6, 11, 4, 2); p('#f4efe6', 5, 13, 6, 4); p('#6f4628', 6, 13, 4, 1)
    p('#3b2418', 0, 18, 16, 2)
  })
  texture(scene, 'cake-stand', 18, 14, p => {
    p('#e9e2d4', 1, 11, 16, 2); p('#c9a24b', 8, 12, 2, 2)
    p('#f6e7c8', 3, 4, 12, 7); p('#e05a6c', 3, 6, 12, 1); p('#fffaf0', 3, 3, 12, 2)
    p('#d9475c', 5, 1, 2, 2); p('#d9475c', 11, 1, 2, 2); p('#5f9c5e', 8, 0, 1, 2); p('#b57a3c', 3, 9, 12, 2)
  })
  texture(scene, 'emote-coffee', 10, 10, p => {
    p('#ffffff', 1, 3, 7, 6); p('#6f4628', 2, 4, 5, 2); p('#ffffff', 8, 4, 2, 3); p('#cbd5e1', 3, 0, 1, 2); p('#cbd5e1', 5, 0, 1, 2)
  })
  texture(scene, 'emote-cake', 10, 10, p => {
    p('#f6e7c8', 1, 4, 8, 5); p('#fffaf0', 1, 3, 8, 2); p('#e05a6c', 1, 6, 8, 1); p('#d9475c', 4, 1, 2, 2); p('#b57a3c', 1, 8, 8, 1)
  })
  texture(scene, 'book', 6, 8, p => { p('#ffffff', 0, 0, 6, 8); p('#d9d9d9', 5, 0, 1, 8); p('#bfbfbf', 1, 1, 1, 6) })
  // 떨어지는 나뭇잎 (tint로 녹색 계열 변주)
  texture(scene, 'leaf', 4, 3, p => { p('#ffffff', 1, 0, 2, 1); p('#ffffff', 0, 1, 4, 1); p('#ffffff', 1, 2, 2, 1) })
  // 의자에 앉은 연구원(뒷모습). 의자 등받이 위로 머리와 어깨만 보인다.
  texture(scene, 'researcher-sit', 16, 20, p => {
    p('#2c4147', 4, 1, 8, 9); p('#553f38', 4, 1, 8, 8); p('#78554a', 5, 1, 6, 1)
    p('#edc99b', 4, 8, 1, 2); p('#edc99b', 11, 8, 1, 2)
    p('#38595c', 3, 10, 10, 10); p('#f2ead1', 4, 10, 8, 9); p('#d7d9c2', 6, 10, 4, 2)
    p('#edd3a7', 2, 12, 2, 4); p('#edd3a7', 12, 12, 2, 4)
  })
  texture(scene, 'confetti', 3, 2, p => p('#ffffff', 0, 0, 3, 2))
  texture(scene, 'clock-face', 14, 14, p => {
    p('#5f3d24', 3, 0, 8, 14); p('#5f3d24', 0, 3, 14, 8); p('#5f3d24', 1, 1, 12, 12)
    p('#f8f5ef', 4, 1, 6, 12); p('#f8f5ef', 1, 4, 12, 6); p('#f8f5ef', 2, 2, 10, 10)
    p('#5f3d24', 7, 2, 1, 1); p('#5f3d24', 7, 11, 1, 1); p('#5f3d24', 2, 7, 1, 1); p('#5f3d24', 11, 7, 1, 1)
  })
}
