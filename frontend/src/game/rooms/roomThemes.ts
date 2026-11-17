import type { RoomId } from '../maps/rooms.ts'

/** 바닥 타일셋의 세 프레임: 기본, 보조 무늬, 강조(카펫·케이블·통풍구 등) */
export type FloorPalette = { base: string; baseLine: string; alt: string; altLine: string; accent: string; accentLine: string; accentDetail: string }
export type WallPalette = { upper: string; upperLight: string; lower: string; lowerDark: string; trim: string; detail: string; side: string; bottom: string }
export type DoorPalette = { frame: string; frameLight: string; panel: string; panelLight: string; handle: string; sign: string }
/** React 페이지 테두리·배경도 같은 방 분위기로 맞춘다. */
export type PagePalette = { background: string; card: string; border: string; accent: string; muted: string }
export type RoomTheme = {
  mood: string
  camera: string
  light: string
  floor: FloorPalette
  wall: WallPalette
  door: DoorPalette
  page: PagePalette
  /** 공유 맵의 가구 키를 방 분위기에 맞는 클라이언트 전용 텍스처로 바꾼다. 충돌 영역은 그대로다. */
  textures: Record<string, string>
  notes: { title: string; body: string; missionTitle: string; mission: string }
}

export const ROOM_THEMES: Record<RoomId, RoomTheme> = {
  lobby: {
    mood: '따뜻한 대리석과 레드 카펫, 샹들리에가 있는 호텔식 로비',
    camera: '#2a1d17', light: '#ffd89a',
    floor: { base: '#efe6d6', baseLine: '#d9cdb7', alt: '#e4d8c1', altLine: '#cfc0a5', accent: '#8c2f39', accentLine: '#6e2129', accentDetail: '#c9a24b' },
    wall: { upper: '#f1e4c9', upperLight: '#fbf3e1', lower: '#5a3a2a', lowerDark: '#3b2418', trim: '#c9a24b', detail: '#7a5238', side: '#5a3a2a', bottom: '#3b2418' },
    door: { frame: '#3b2418', frameLight: '#c9a24b', panel: '#6e4a33', panelLight: '#8f6446', handle: '#e7c66f', sign: '#c9a24b' },
    page: { background: '#1f1612', card: '#2c1f19', border: '#6b4b36', accent: '#e0b867', muted: '#c9b49a' },
    textures: { reception: 'lobby-desk', rack: 'bookshelf', equipment: 'lounge-sofa', chair: 'armchair', computer: 'kiosk', plant: 'tall-plant' },
    notes: { title: '어서 오세요,\n연구원님.', body: '대리석 로비에서\n오늘의 탐험을 시작해요.', missionTitle: '안내 데스크와 키오스크', mission: '키오스크에서 E로 연구 기록을 열고, 양옆 네 문으로 각 연구실에, 아래 문으로 바깥 초원에 나가 보세요.' },
  },
  'development-lab': {
    mood: '어두운 네이비 위에 네온 그린 모니터가 빛나는 해커 연구실',
    camera: '#0a0f19', light: '#39e6b4',
    floor: { base: '#141c2b', baseLine: '#1a2436', alt: '#152033', altLine: '#1f4d6b', accent: '#121a28', accentLine: '#0c1320', accentDetail: '#39e6b4' },
    wall: { upper: '#1b2538', upperLight: '#26344d', lower: '#0f1522', lowerDark: '#0a0f19', trim: '#39e6b4', detail: '#38bdf8', side: '#0f1522', bottom: '#0a0f19' },
    door: { frame: '#0a0f19', frameLight: '#38bdf8', panel: '#1b2538', panelLight: '#2b3a55', handle: '#39e6b4', sign: '#39e6b4' },
    page: { background: '#0a1019', card: '#101827', border: '#24405a', accent: '#39e6b4', muted: '#8fb3c9' },
    textures: { computer: 'dev-desk', chair: 'gaming-chair', equipment: 'workbench' },
    notes: { title: '빌드는\n멈추지 않아요.', body: '네온 모니터 앞에서\n코드를 다듬는 곳입니다.', missionTitle: 'CI 파이프라인', mission: '개발 연구원들의 로비예요. 양옆 네 문은 개인 사무실(1~4번)로 이어지고, 책상 컴퓨터에서 E를 누르면 실제 서버 빌드 정보를 볼 수 있어요.' },
  },
  'server-room': {
    mood: '차가운 파란 조명과 이중 바닥, 경고 줄무늬가 있는 서버실',
    camera: '#0b1015', light: '#5fb6ff',
    floor: { base: '#3a4654', baseLine: '#2a333e', alt: '#34404d', altLine: '#29313b', accent: '#2c3a48', accentLine: '#222d38', accentDetail: '#5b8fb8' },
    wall: { upper: '#1c232c', upperLight: '#27313d', lower: '#141a21', lowerDark: '#0d1116', trim: '#e2b33c', detail: '#5fb6ff', side: '#1c232c', bottom: '#12171d' },
    door: { frame: '#0d1116', frameLight: '#e2b33c', panel: '#4a5868', panelLight: '#617387', handle: '#5fb6ff', sign: '#e2b33c' },
    page: { background: '#0c1116', card: '#141b23', border: '#2d3a48', accent: '#5fb6ff', muted: '#9fb2c4' },
    textures: { rack: 'server-rack', equipment: 'cooling-unit' },
    notes: { title: '차갑게,\n안정적으로.', body: '랙이 숨 쉬는 소리를\n들어 보세요.', missionTitle: '과열 경보 대응', mission: '경보가 울리면 랙 앞에서 E로 냉각 시스템을 가동하세요. 평소에는 E로 실시간 서버 상태를 볼 수 있어요.' },
  },
  'meeting-room': {
    mood: '원목 마루와 세이지 카펫, 화이트보드가 있는 아늑한 회의실',
    camera: '#1e1712', light: '#ffe2b0',
    floor: { base: '#b98252', baseLine: '#9c6a3f', alt: '#c99463', altLine: '#a8764a', accent: '#4f7a5a', accentLine: '#43694d', accentDetail: '#6c9775' },
    wall: { upper: '#efe3cf', upperLight: '#f8efe0', lower: '#8a5a36', lowerDark: '#5f3d24', trim: '#d9c4a0', detail: '#a87a52', side: '#8a5a36', bottom: '#5f3d24' },
    door: { frame: '#5f3d24', frameLight: '#d9c4a0', panel: '#a87a52', panelLight: '#c4966a', handle: '#e7d29a', sign: '#4f7a5a' },
    page: { background: '#1c1813', card: '#29231b', border: '#5e5140', accent: '#9cc79f', muted: '#c4b8a2' },
    textures: { reception: 'meeting-table', chair: 'office-chair', equipment: 'whiteboard' },
    notes: { title: '함께 고민하면\n더 멀리 가요.', body: '따뜻한 원목 테이블에\n둘러앉아 이야기해요.', missionTitle: '테이블 대화', mission: '테이블 가까이에서 E를 누르면 테이블 대화가 켜지고 조명이 회의 모드로 바뀌어요.' },
  },
  'control-room': {
    mood: '어두운 관제실에 CCTV 모니터 월과 앰버 콘솔이 빛나는 상황실',
    camera: '#070a0d', light: '#ffb547',
    floor: { base: '#1a2026', baseLine: '#12171c', alt: '#1d242b', altLine: '#141a20', accent: '#22201a', accentLine: '#17150f', accentDetail: '#ffb547' },
    wall: { upper: '#151b21', upperLight: '#1f2830', lower: '#0d1115', lowerDark: '#080b0e', trim: '#ffb547', detail: '#4ade80', side: '#11161b', bottom: '#0b0f13' },
    door: { frame: '#080b0e', frameLight: '#ffb547', panel: '#26303a', panelLight: '#38454f', handle: '#ffb547', sign: '#4ade80' },
    page: { background: '#080b0f', card: '#10161c', border: '#2a3540', accent: '#ffb547', muted: '#9aa8b5' },
    // 모니터 월·콘솔은 공유 맵에 전용 텍스처 키(monitor-wall, control-console)로 들어 있다.
    textures: { chair: 'operator-chair', rack: 'control-rack' },
    notes: { title: '모든 방을\n한눈에.', body: '모니터 월에서 각 방의\n연구원을 실시간으로 봐요.', missionTitle: 'CCTV 관제', mission: '벽 모니터에 각 방의 연구원이 실시간으로 보여요. 콘솔에서 E를 누르면 이름과 위치를 크게 볼 수 있어요.' },
  },
  'office-1': {
    mood: '밝은 원목 책상과 책장이 있는 단정한 개인 오피스',
    camera: '#1d1914', light: '#ffe9c4',
    floor: { base: '#c9a77c', baseLine: '#b08d63', alt: '#d2b088', altLine: '#b8966c', accent: '#5a6f8c', accentLine: '#4b5f7a', accentDetail: '#8fa6c4' },
    wall: { upper: '#efe8dc', upperLight: '#faf5ec', lower: '#7a5a3e', lowerDark: '#5a3f2a', trim: '#c4a57a', detail: '#9c7a55', side: '#7a5a3e', bottom: '#5a3f2a' },
    door: { frame: '#5a3f2a', frameLight: '#c4a57a', panel: '#9c7a55', panelLight: '#b8936a', handle: '#e7d29a', sign: '#5a6f8c' },
    page: { background: '#1b1814', card: '#28221b', border: '#5c4d3b', accent: '#e8c48a', muted: '#c8b89f' },
    textures: { computer: 'dev-desk', chair: 'office-chair', rack: 'bookshelf', equipment: 'workbench', plant: 'tall-plant' },
    notes: { title: '1번 오피스', body: '정돈된 책상에서\n차분하게 집중해요.', missionTitle: '개인 오피스', mission: '책상 컴퓨터에서 E로 빌드 정보를 볼 수 있어요. 아래 문으로 개발 연구실에 돌아가요.' },
  },
  'office-2': {
    mood: '하얀 벽과 빈 공간, 책상 하나와 화분 하나뿐인 미니멀 라이프',
    camera: '#1a1c1d', light: '#ffffff',
    floor: { base: '#ecebe6', baseLine: '#dcdad3', alt: '#f2f1ec', altLine: '#e2e0d9', accent: '#d8d3c6', accentLine: '#c9c3b4', accentDetail: '#b5ad9b' },
    wall: { upper: '#f7f6f2', upperLight: '#ffffff', lower: '#dcd8cd', lowerDark: '#c4bfb2', trim: '#cfc9bb', detail: '#e5e1d6', side: '#dcd8cd', bottom: '#c4bfb2' },
    door: { frame: '#c4bfb2', frameLight: '#ffffff', panel: '#e9e6dd', panelLight: '#f7f6f2', handle: '#9a927f', sign: '#b5ad9b' },
    page: { background: '#171818', card: '#222424', border: '#4a4c4a', accent: '#d9d4c7', muted: '#b3b0a8' },
    textures: { computer: 'dev-desk', chair: 'office-chair', plant: 'tall-plant' },
    notes: { title: '2번\n미니멀 라이프', body: '덜어 낼수록\n생각이 맑아져요.', missionTitle: '비움', mission: '책상과 화분 하나뿐인 방이에요. 컴퓨터에서 E로 빌드 정보를 볼 수 있어요.' },
  },
  'office-3': {
    mood: '네온이 번쩍이는 보랏빛 오락실(월루 전용 휴게 공간)',
    camera: '#0a0414', light: '#f472b6',
    floor: { base: '#1c1030', baseLine: '#140a24', alt: '#241540', altLine: '#1a0e30', accent: '#2a1450', accentLine: '#1f0e3c', accentDetail: '#38bdf8' },
    wall: { upper: '#1a0e2e', upperLight: '#2a1748', lower: '#0f0820', lowerDark: '#090414', trim: '#f472b6', detail: '#38bdf8', side: '#140a24', bottom: '#090414' },
    door: { frame: '#090414', frameLight: '#f472b6', panel: '#2a1748', panelLight: '#3d2466', handle: '#ffd23f', sign: '#38bdf8' },
    page: { background: '#0c0616', card: '#170c28', border: '#4c2a7a', accent: '#f472b6', muted: '#c4b5fd' },
    textures: { computer: 'arcade-machine', chair: 'arcade-stool', rack: 'arcade-cabinet', equipment: 'claw-machine', plant: 'tall-plant' },
    notes: { title: '3번\n오락실', body: '잠깐 쉬어 가요.\n최고 점수에 도전!', missionTitle: '벽돌 부수기', mission: '가운데 큰 오락기에서 E를 누르면 벽돌 부수기를 할 수 있어요. 최고 점수는 이 브라우저에 남아요.' },
  },
  'office-4': {
    mood: '1번과 같은 배치의 단정한 개인 오피스(푸른 카펫)',
    camera: '#14181d', light: '#e3efff',
    floor: { base: '#c9a77c', baseLine: '#b08d63', alt: '#d2b088', altLine: '#b8966c', accent: '#3f6b7a', accentLine: '#335a67', accentDetail: '#7fb3c4' },
    wall: { upper: '#e6edf2', upperLight: '#f4f8fa', lower: '#4f6472', lowerDark: '#3a4b56', trim: '#9cb5c4', detail: '#6f8796', side: '#4f6472', bottom: '#3a4b56' },
    door: { frame: '#3a4b56', frameLight: '#9cb5c4', panel: '#6f8796', panelLight: '#8aa2b0', handle: '#e7d29a', sign: '#3f6b7a' },
    page: { background: '#12161a', card: '#1b2228', border: '#3e4f5b', accent: '#8fc4d9', muted: '#a9bac4' },
    textures: { computer: 'dev-desk', chair: 'office-chair', rack: 'bookshelf', equipment: 'workbench', plant: 'tall-plant' },
    notes: { title: '4번 오피스', body: '1번과 같은 구조,\n조금 더 시원한 색이에요.', missionTitle: '개인 오피스', mission: '책상 컴퓨터에서 E로 빌드 정보를 볼 수 있어요. 아래 문으로 개발 연구실에 돌아가요.' },
  },
  outdoor: {
    mood: '연구소 밖, 시간 따라 하늘과 빛이 바뀌는 초원과 호수, 낚시터가 있는 강',
    camera: '#1b2a1a', light: '#fff1c4',
    floor: { base: '#6fae58', baseLine: '#5f9b4b', alt: '#78b860', altLine: '#64a24f', accent: '#b89a64', accentLine: '#a3875a', accentDetail: '#8a6f45' },
    wall: { upper: '#78b8e8', upperLight: '#a8d4f2', lower: '#3f7a3a', lowerDark: '#2e5c2b', trim: '#4f8c45', detail: '#2e5c2b', side: '#3f7a3a', bottom: '#2e5c2b' },
    door: { frame: '#3b2418', frameLight: '#c9a24b', panel: '#6e4a33', panelLight: '#8f6446', handle: '#e7c66f', sign: '#c9a24b' },
    page: { background: '#13200f', card: '#1b2b17', border: '#3f5e36', accent: '#a7d98a', muted: '#bfd3b0' },
    // 나무·바위는 전용 텍스처 키(oak-tree, field-rock)로, 호수·강(lake, river)은 충돌만 있고 OutdoorFx가 그린다.
    textures: {},
    notes: { title: '잠깐,\n바람 쐬러.', body: '시간에 따라 하늘과 빛이\n실제처럼 바뀌어요.', missionTitle: '강가 낚시', mission: '강가 나무 데크에서 E로 낚싯대를 던지고, 찌가 잠기면 E! 게이지 바늘이 초록 칸에 올 때 다시 E로 낚아 올려요.' },
  },
}

const COLUMNS = 25
const ROWS = 19

/** 방마다 바닥 타일 배치(0 기본, 1 보조, 2 강조)를 만든다. 25×19, 32px 표시 타일. */
export function floorData(roomId: RoomId): number[][] {
  return Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLUMNS }, (_, column) => {
    if (roomId === 'lobby') {
      // 정문(아래 중앙)에서 안내 데스크까지 이어지는 레드 카펫과 체크 대리석
      if (column >= 11 && column <= 13 && row >= 7) return 2
      return (row + column) % 2
    }
    if (roomId === 'development-lab') {
      // 책상(좌·우)으로 이어지는 네온 케이블 덕트와 4칸 격자
      if (row === 12 || (row >= 8 && row <= 12 && (column === 5 || column === 19))) return 2
      return row % 4 === 0 || column % 4 === 0 ? 1 : 0
    }
    if (roomId === 'server-room') {
      // 랙 앞 냉복도의 타공 통풍 타일
      if (row >= 9 && row <= 10 && column >= 3 && column <= 21) return 2
      return (row * 3 + column) % 7 === 0 ? 1 : 0
    }
    if (roomId === 'control-room') {
      // 콘솔 앞뒤 앰버 안전선과 고무 바닥
      if ((row === 7 || row === 11) && column >= 6 && column <= 18) return 2
      return (row + column) % 3 === 0 ? 1 : 0
    }
    if (roomId === 'outdoor') {
      // 연구소 문에서 위로 올라가 다리로 꺾이는 흙길, 나머지는 풀
      if (column === 12 && row >= 10) return 2
      if (row === 10 && column >= 12 && column <= 20) return 2
      return (row * 7 + column * 3) % 5 === 0 ? 1 : 0
    }
    // 회의실: 테이블 주변 카펫과 엇갈린 원목 마루
    if (row >= 4 && row <= 14 && column >= 8 && column <= 16) return 2
    return (column + (row >> 1)) % 2
  }))
}
