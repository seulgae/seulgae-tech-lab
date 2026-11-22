import { RESEARCHER_STYLES } from '../npc/npcData.ts'
import type Phaser from 'phaser'

export type Paint = (color: string, x: number, y: number, width: number, height: number) => void
const ink = '#1b292f'
const wood = '#c49a70'
const lightWood = '#e4c49a'
const teal = '#65b3a5'

/** 정수 좌표로만 그린 원본 픽셀 텍스처를 등록한다. 외부 이미지나 폰트를 사용하지 않는다. */
export function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (paint: Paint) => void) {
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
  petRobot(scene)
  townsfolk(scene)
  kidsAndFisher(scene)
  professor(scene)
  labStaff(scene)
  seatedStaff(scene)
  // 관리자실 앞 작은 관리자 신청 컴퓨터(10×8, 2배로 그린다)
  texture(scene, 'mini-terminal', 10, 8, (p) => {
    p(ink, 0, 0, 10, 6); p('#1f3a3f', 1, 1, 8, 4); p('#39e6b4', 2, 2, 4, 1); p('#e7c66f', 2, 3, 6, 1)
    p('#26344d', 3, 6, 4, 1); p(ink, 2, 7, 6, 1)
  })
  foodCart(scene)
}

type Look = { skin: string; hair: string; top: string; bottom: string; shoes: string }
const LOOKS: Record<'woman' | 'man' | 'elder' | 'cleaner', Look> = {
  woman: { skin: '#f3c9a8', hair: '#5a3424', top: '#f29bb5', bottom: '#4e6fa8', shoes: '#3b2418' },
  man: { skin: '#e8b98f', hair: '#2b2220', top: '#5b8fd1', bottom: '#3d4656', shoes: '#1b1b1b' },
  elder: { skin: '#e9c3a0', hair: '#e8e8e8', top: '#8a6a4f', bottom: '#5c5047', shoes: '#3b2418' },
  cleaner: { skin: '#f0c19c', hair: '#4a2f22', top: '#7cc3a2', bottom: '#59606b', shoes: '#2f2f2f' },
}

/** 바깥 시민(여자·남자·어르신)과 로비 청소 아주머니. 16×24, 걷기 두 프레임 */
function townsfolk(scene: Phaser.Scene) {
  for (const kind of ['woman', 'man', 'elder', 'cleaner'] as const) {
    for (const frame of [0, 1]) {
      texture(scene, `npc-${kind}-${frame}`, 16, 24, (p) => {
        const look = LOOKS[kind]
        // 다리(걷기 프레임에 따라 엇갈림)와 신발
        const left = frame ? 1 : 0, right = frame ? 0 : 1
        if (kind === 'woman') {
          p(look.bottom, 4, 15, 8, 4); p(ink, 4, 18, 8, 1)
          p(look.skin, 5, 19, 2, 3 - left); p(look.skin, 9, 19, 2, 3 - right)
        } else {
          p(look.bottom, 5, 15, 2, 7 - left); p(look.bottom, 9, 15, 2, 7 - right)
        }
        p(look.shoes, 5, 22 - left, 2, 2); p(look.shoes, 9, 22 - right, 2, 2)
        // 몸통과 팔
        p(ink, 4, 9, 8, 7); p(look.top, 5, 9, 6, 6); p(look.top, 3, 10, 1, 4); p(look.top, 12, 10, 1, 4)
        p(look.skin, 3, 14, 1, 1); p(look.skin, 12, 14, 1, 1)
        // 얼굴
        p(ink, 4, 2, 8, 8); p(look.skin, 5, 3, 6, 6)
        p(ink, 6, 6, 1, 1); p(ink, 9, 6, 1, 1); p('#ff9bb3', 5, 7, 1, 1); p('#ff9bb3', 10, 7, 1, 1)
        if (kind === 'woman') {
          // 긴 머리와 앞머리, 머리핀
          p(look.hair, 4, 1, 8, 3); p(look.hair, 3, 3, 2, 8); p(look.hair, 11, 3, 2, 8); p(look.hair, 5, 3, 3, 1)
          p('#ffd23f', 10, 2, 1, 1)
        } else if (kind === 'man') {
          // 짧은 머리, 사원증 끈
          p(look.hair, 4, 1, 8, 3); p(look.hair, 4, 3, 1, 2); p(look.hair, 11, 3, 1, 2)
          p('#ffd23f', 7, 10, 2, 3); p('#ffffff', 7, 12, 2, 1)
        } else if (kind === 'elder') {
          // 흰 머리, 안경, 지팡이
          p(look.hair, 5, 1, 6, 2); p(look.hair, 4, 2, 1, 3); p(look.hair, 11, 2, 1, 3)
          p('#2b2b2b', 5, 5, 3, 1); p('#2b2b2b', 8, 5, 3, 1)
          p('#6b4a2a', 13, 11, 1, 12); p('#6b4a2a', 12, 11, 2, 1)
        } else {
          // 머릿수건, 앞치마, 대걸레
          p('#e05a6c', 4, 1, 8, 3); p('#e05a6c', 11, 3, 2, 2); p('#ffffff', 6, 2, 1, 1)
          p('#fff2d2', 6, 10, 4, 5)
          p('#b08a5a', 14, 6, 1, 15); p('#dfe6ea', 12, 21, 4, 2); p('#b9c3c9', 12, 22, 4, 1)
        }
      })
    }
  }
}

/** 뛰어노는 아이 둘(16×24 캔버스 아래쪽에 작게)과 데크 옆 낚시꾼(챙 모자·조끼·낚싯대) */
function kidsAndFisher(scene: Phaser.Scene) {
  const kids = {
    'kid-boy': { skin: '#f3c9a8', hair: '#3b2418', top: '#ffd23f', bottom: '#4e6fa8', shoes: '#e05a6c' },
    'kid-girl': { skin: '#f6d0b0', hair: '#6b3a2a', top: '#a7d98a', bottom: '#f29bb5', shoes: '#ffffff' },
  } as const
  for (const [kind, look] of Object.entries(kids)) {
    for (const frame of [0, 1]) {
      texture(scene, `npc-${kind}-${frame}`, 16, 24, (p) => {
        const left = frame ? 1 : 0, right = frame ? 0 : 1
        // 다리·신발(짧게)
        p(look.bottom, 5, 18, 2, 4 - left); p(look.bottom, 9, 18, 2, 4 - right)
        p(look.shoes, 5, 22 - left, 2, 2); p(look.shoes, 9, 22 - right, 2, 2)
        // 몸통(작게)
        p(ink, 4, 13, 8, 6); p(look.top, 5, 13, 6, 5); p(look.top, 3, 14, 1, 3); p(look.top, 12, 14, 1, 3)
        // 큰 머리(아이 비율)
        p(ink, 3, 5, 10, 9); p(look.skin, 4, 6, 8, 7)
        p(ink, 6, 9, 1, 1); p(ink, 9, 9, 1, 1); p('#ff9bb3', 5, 11, 1, 1); p('#ff9bb3', 10, 11, 1, 1); p('#c0504d', 7, 11, 2, 1)
        if (kind === 'kid-girl') { p(look.hair, 3, 4, 10, 3); p(look.hair, 2, 6, 2, 5); p(look.hair, 12, 6, 2, 5); p('#ff7aa8', 2, 5, 2, 2); p('#ff7aa8', 12, 5, 2, 2) }
        else { p(look.hair, 3, 4, 10, 3); p(look.hair, 3, 6, 1, 2); p(look.hair, 12, 6, 1, 2); p('#e05a6c', 4, 3, 8, 2); p('#e05a6c', 11, 4, 3, 1) }
      })
    }
  }
  for (const frame of [0, 1]) {
    texture(scene, `npc-fisher-${frame}`, 16, 24, (p) => {
      // 다리·장화
      p('#4b5560', 5, 16, 2, 6); p('#4b5560', 9, 16, 2, 6); p('#2f8a4a', 5, 21, 2, 3); p('#2f8a4a', 9, 21, 2, 3)
      // 체크 셔츠와 낚시 조끼
      p(ink, 4, 9, 8, 8); p('#c0504d', 5, 9, 6, 7); p('#8a8f5a', 5, 10, 2, 6); p('#8a8f5a', 9, 10, 2, 6)
      p('#c0504d', 3, 10, 1, 4); p('#c0504d', 12, 10, 1, 3); p('#e8b98f', 12, 13, 2, 1)
      // 얼굴·수염·챙 모자
      p(ink, 4, 3, 8, 7); p('#e8b98f', 5, 4, 6, 5); p(ink, 6, 6, 1, 1); p(ink, 9, 6, 1, 1); p('#6b5a4a', 6, 8, 4, 1)
      p('#d9c27a', 3, 2, 10, 2); p('#b89a52', 5, 0, 6, 2)
      // 낚싯대(오른쪽 위로), 끝이 까딱
      for (let i = 0; i < 6; i++) p('#6b4a2a', 13 + Math.floor(i / 3), 13 - i * 2, 1, 2)
      p('#dfe6ea', 15, frame ? 2 : 1, 1, frame ? 6 : 5)
    })
  }
}

/**
 * 괴짜 박사님(아인슈타인 같은 연구원): 사방으로 뻗친 흰 머리, 덥수룩한 콧수염, 흰 가운.
 * 걷기 두 프레임과 놀란 얼굴(shock), 웃는 얼굴(happy)
 */
function professor(scene: Phaser.Scene) {
  const frames: [string, number, 'normal' | 'shock' | 'happy'][] = [['npc-professor-0', 0, 'normal'], ['npc-professor-1', 1, 'normal'], ['npc-professor-shock', 0, 'shock'], ['npc-professor-happy', 0, 'happy']]
  for (const [key, frame, face] of frames) {
    texture(scene, key, 16, 24, (p) => {
      const left = frame ? 1 : 0, right = frame ? 0 : 1
      p('#5a4636', 5, 16, 2, 6 - left); p('#5a4636', 9, 16, 2, 6 - right)
      p('#2b2220', 5, 22 - left, 2, 2); p('#2b2220', 9, 22 - right, 2, 2)
      // 흰 가운과 넥타이, 주머니 펜
      p(ink, 3, 9, 10, 9); p('#f4f6f8', 4, 9, 8, 8); p('#c0504d', 7, 10, 2, 4); p('#5b8fd1', 10, 11, 1, 2)
      p('#f4f6f8', 2, 10, 1, 5); p('#f4f6f8', 13, 10, 1, 5)
      if (face === 'shock') { p('#e9c3a0', 1, 7, 1, 2); p('#e9c3a0', 14, 7, 1, 2) } else { p('#e9c3a0', 2, 15, 1, 1); p('#e9c3a0', 13, 15, 1, 1) }
      // 얼굴
      p(ink, 4, 3, 8, 7); p('#e9c3a0', 5, 4, 6, 5)
      if (face === 'shock') { p(ink, 5, 5, 2, 2); p(ink, 9, 5, 2, 2); p('#ffffff', 5, 5, 1, 1); p('#ffffff', 9, 5, 1, 1); p(ink, 7, 8, 2, 2) }
      else if (face === 'happy') { p(ink, 5, 6, 2, 1); p(ink, 9, 6, 2, 1); p('#ff9bb3', 5, 7, 1, 1); p('#ff9bb3', 10, 7, 1, 1) }
      else { p(ink, 6, 6, 1, 1); p(ink, 9, 6, 1, 1) }
      // 덥수룩한 흰 콧수염(웃으면 입꼬리가 보인다)
      p('#f0f0f0', 5, 8, 6, 1); if (face === 'happy') p('#c0504d', 7, 9, 2, 1)
      // 사방으로 뻗친 흰 머리(놀라면 더 뻗친다)
      const spike = face === 'shock' ? 1 : 0
      p('#f0f0f0', 3, 1 - spike, 10, 3); p('#f0f0f0', 2, 3, 2, 4); p('#f0f0f0', 12, 3, 2, 4)
      p('#d9d9d9', 1, 2 - spike, 2, 2); p('#d9d9d9', 13, 2 - spike, 2, 2); p('#d9d9d9', 6, 0, 1, 1); p('#d9d9d9', 10, 0, 1, 1)
      if (face === 'shock') { p('#f0f0f0', 0, 4, 2, 1); p('#f0f0f0', 14, 4, 2, 1); p('#f0f0f0', 7, 0, 2, 1) }
    })
  }
}

/**
 * 서비스 연구실 연구원 둘: 긴 갈색 머리 여자 연구원(분홍 사원증 끈), 안경 쓴 남자 연구원(초록 셔츠).
 * 둘 다 흰 가운과 짙은 바지, 16×24, 걷기 두 프레임
 */
function labStaff(scene: Phaser.Scene) {
  for (const appearance of RESEARCHER_STYLES) {
    const { kind, skin, hair } = appearance
    const woman = appearance.style === 'long' || appearance.style === 'bob'
    for (const frame of [0, 1]) {
      texture(scene, `npc-${kind}-${frame}`, 16, 24, (p) => {
        const left = frame ? 1 : 0, right = frame ? 0 : 1
        // 짙은 바지와 신발
        p('#2f3a4c', 5, 16, 2, 6 - left); p('#2f3a4c', 9, 16, 2, 6 - right)
        p('#1b1b1b', 5, 22 - left, 2, 2); p('#1b1b1b', 9, 22 - right, 2, 2)
        // 흰 가운(안쪽 셔츠가 보이게 앞섶을 연다), 사원증
        p(ink, 3, 9, 10, 9); p('#f4f6f8', 4, 9, 8, 8); p('#dfe4ea', 4, 15, 8, 1)
        p(appearance.shirt, 7, 9, 2, 6)
        p(woman ? '#f29bb5' : '#5b8fd1', 6, 9, 1, 3); p(woman ? '#f29bb5' : '#5b8fd1', 9, 9, 1, 3); p('#ffffff', 7, 12, 2, 2); p(appearance.badge, 7, 13, 2, 1)
        p('#f4f6f8', 2, 10, 1, 5); p('#f4f6f8', 13, 10, 1, 5); p(skin, 2, 15, 1, 1); p(skin, 13, 15, 1, 1)
        // 얼굴
        p(ink, 4, 3, 8, 7); p(skin, 5, 4, 6, 5)
        if (woman) {
          p(ink, 6, 6, 1, 1); p(ink, 9, 6, 1, 1); p('#ff9bb3', 5, 7, 1, 1); p('#ff9bb3', 10, 7, 1, 1)
          // 긴 갈색 머리: 앞머리와 어깨 아래까지 내려오는 옆머리
          p(hair, 4, 1, 8, 3); p(hair, 5, 3, 2, 1); p(hair, 9, 3, 2, 1)
          p(hair, 3, 2, 2, appearance.style === 'bob' ? 7 : 10); p(hair, 11, 2, 2, appearance.style === 'bob' ? 7 : 10); p('#a8714c', 4, 1, 3, 1)
        } else {
          // 안경(검은 테), 짧은 검은 머리
          // 위 테와 코받침은 회색, 렌즈는 밝게(눈은 렌즈 안쪽)
          p('#4a4f57', 5, 5, 6, 1); p('#cfe8ff', 5, 6, 1, 1); p('#cfe8ff', 10, 6, 1, 1)
          p(ink, 6, 6, 1, 1); p(ink, 9, 6, 1, 1); p('#ff9bb3', 5, 8, 1, 1); p('#ff9bb3', 10, 8, 1, 1)
          p(hair, 4, 1, 8, 3); p(hair, 4, 3, 1, 2); p(hair, 11, 3, 1, 2); p(hair, 6, 3, 3, 1)
          p('#c0504d', 7, 9, 2, 1)
        }
        if (appearance.glasses) { p('#4a4f57', 4, 5, 8, 1); p('#cfe8ff', 5, 6, 1, 1); p('#cfe8ff', 10, 6, 1, 1) }
        if (appearance.style === 'curly') for (const x of [3, 6, 9, 12]) p(hair, x, 0, 2, 3)
      })
    }
  }
}

/** 컴퓨터를 향한 뒷모습: 기존 의자 위에 가운·팔·짧게 접힌 다리를 그린다. */
function seatedStaff(scene: Phaser.Scene) {
  for (const kind of [...RESEARCHER_STYLES.map(style => style.kind), 'professor'] as const) {
    const appearance = RESEARCHER_STYLES.find(style => style.kind === kind)
    const woman = appearance?.style === 'long' || appearance?.style === 'bob', professor = kind === 'professor'
    const hair = professor ? '#edf0f1' : appearance!.hair
    for (const frame of [0, 1]) {
      texture(scene, `npc-${kind}-seated-${frame}`, 16, 24, p => {
        // 발은 의자 아래, 가운 등판은 등받이 위로 보인다.
        p('#263345', 4, 18, 3, 3); p('#263345', 9, 18, 3, 3)
        p(ink, 3, 21, 4, 2); p(ink, 9, 21, 4, 2)
        p(ink, 3, 9, 10, 10); p('#eef3f5', 4, 9, 8, 9)
        p('#bdcdd3', 7, 11, 1, 6); p('#cdd9dd', 4, 17, 8, 1)
        // 팔과 손끝만 번갈아 움직여 키보드를 두드린다.
        p('#dfe9ed', 1, 10 + frame, 3, 4); p('#dfe9ed', 12, 11 - frame, 3, 4)
        p('#efc5a2', 1, 9 + frame, 2, 2); p('#efc5a2', 13, 10 - frame, 2, 2)
        p(ink, 4, 2, 8, 8); p(hair, 4, 2, 8, 7)
        p(professor ? '#c9d5da' : '#563b30', 5, 8, 6, 1)
        if (woman) { p(hair, 3, 3, 2, 9); p(hair, 11, 3, 2, 9); p('#b17a55', 4, 3, 2, 5) }
        if (appearance?.style === 'curly') for (const x of [3, 6, 9, 12]) p(hair, x, 0, 2, 3)
        if (professor) { p(hair, 2, 3, 2, 4); p(hair, 12, 3, 2, 4); p(hair, 3, 1, 3, 2); p(hair, 10, 1, 3, 2) }
      })
    }
  }
}

/** 포장마차: 주황 비닐 지붕, 붉은 등, 김이 나는 냄비와 나무 바퀴. 48×40(2배로 그린다) */
function foodCart(scene: Phaser.Scene) {
  texture(scene, 'food-cart', 48, 40, (p) => {
    // 지붕(주황 천막)과 기둥
    p(ink, 2, 2, 44, 9); p('#f07a2b', 3, 3, 42, 7); p('#ff9a4d', 3, 3, 42, 2)
    for (let x = 3; x < 45; x += 6) p('#d9601a', x, 8, 3, 2)
    p('#5a3a2a', 5, 11, 2, 18); p('#5a3a2a', 41, 11, 2, 18)
    // 붉은 등
    p(ink, 21, 11, 6, 7); p('#e23d3d', 22, 12, 4, 5); p('#ffd23f', 23, 13, 2, 1)
    // 비닐 문 사이로 보이는 안쪽(따뜻한 빛)
    p('#ffe1a3', 7, 11, 34, 10); p('#ffd27a', 7, 19, 34, 2)
    // 냄비와 김
    p(ink, 11, 15, 8, 5); p('#9aa4ab', 12, 16, 6, 3); p('#ffffff', 12, 12, 1, 2); p('#ffffff', 15, 11, 1, 3); p('#ffffff', 17, 13, 1, 2)
    // 꼬치와 술병
    p('#c49a70', 30, 14, 1, 6); p('#e05a6c', 29, 15, 3, 2); p('#a7d98a', 29, 17, 3, 2)
    p('#2f8a4a', 35, 14, 2, 6); p('#a7d98a', 35, 13, 2, 1)
    // 수레 판과 바퀴
    p(ink, 3, 21, 42, 9); p('#8c5a3a', 4, 22, 40, 7); p('#a8714c', 4, 22, 40, 2)
    p('#ffd23f', 17, 24, 14, 3); p('#e23d3d', 18, 25, 12, 1)
    for (const x of [8, 34]) { p(ink, x, 30, 8, 8); p('#5a3a2a', x + 1, 31, 6, 6); p('#c49a70', x + 3, 33, 2, 2) }
  })
}

/** 튜토리얼 미니 로봇 펫(16×16, 2배로 그린다): 동그란 화면 얼굴, 안테나, 볼터치. 눈 깜박임용 프레임을 하나 더 둔다. */
function petRobot(scene: Phaser.Scene) {
  for (const blink of [false, true]) {
    texture(scene, blink ? 'pet-robot-blink' : 'pet-robot', 16, 16, (p) => {
      // 안테나: 분홍 전구
      p('#8aa4a8', 7, 2, 2, 1); p('#ff7aa8', 7, 0, 2, 2); p('#ffd1e1', 7, 0, 1, 1)
      // 둥근 머리와 옆 귀
      p(ink, 3, 3, 10, 9); p(ink, 2, 4, 12, 7)
      p('#eaf7f5', 3, 4, 10, 7); p('#ffffff', 4, 4, 3, 1)
      p('#5ad1bf', 1, 6, 1, 3); p('#5ad1bf', 14, 6, 1, 3)
      // 화면 얼굴: 눈(깜박이면 가늘게), 웃는 입
      p('#1f3a3f', 4, 5, 8, 5)
      if (blink) { p('#6ff7de', 5, 7, 2, 1); p('#6ff7de', 9, 7, 2, 1) }
      else { p('#6ff7de', 5, 6, 2, 2); p('#6ff7de', 9, 6, 2, 2); p('#ffffff', 5, 6, 1, 1); p('#ffffff', 9, 6, 1, 1) }
      p('#6ff7de', 7, 9, 2, 1)
      // 볼터치
      p('#ff9bb3', 3, 10, 2, 1); p('#ff9bb3', 11, 10, 2, 1)
      // 작은 몸통과 팔, 가슴 불빛
      p(ink, 5, 12, 6, 3); p('#9fe3d6', 6, 12, 4, 2); p('#ffd23f', 7, 12, 2, 1)
      p('#9fe3d6', 3, 12, 2, 1); p('#9fe3d6', 11, 12, 2, 1)
      p(ink, 6, 15, 4, 1)
    })
  }
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
