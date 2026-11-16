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
    notes: { title: '어서 오세요,\n연구원님.', body: '대리석 로비에서\n오늘의 탐험을 시작해요.', missionTitle: '안내 데스크와 키오스크', mission: '오른쪽 키오스크에서 E로 연구 기록을 열고, 아래 세 문으로 각 연구실에 들어가 보세요.' },
  },
  'development-lab': {
    mood: '어두운 네이비 위에 네온 그린 모니터가 빛나는 해커 연구실',
    camera: '#0a0f19', light: '#39e6b4',
    floor: { base: '#141c2b', baseLine: '#1a2436', alt: '#152033', altLine: '#1f4d6b', accent: '#121a28', accentLine: '#0c1320', accentDetail: '#39e6b4' },
    wall: { upper: '#1b2538', upperLight: '#26344d', lower: '#0f1522', lowerDark: '#0a0f19', trim: '#39e6b4', detail: '#38bdf8', side: '#0f1522', bottom: '#0a0f19' },
    door: { frame: '#0a0f19', frameLight: '#38bdf8', panel: '#1b2538', panelLight: '#2b3a55', handle: '#39e6b4', sign: '#39e6b4' },
    page: { background: '#0a1019', card: '#101827', border: '#24405a', accent: '#39e6b4', muted: '#8fb3c9' },
    textures: { computer: 'dev-desk', chair: 'gaming-chair', equipment: 'workbench' },
    notes: { title: '빌드는\n멈추지 않아요.', body: '네온 모니터 앞에서\n코드를 다듬는 곳입니다.', missionTitle: 'CI 파이프라인', mission: '벽 스크린에서 빌드가 돌아가요. 책상 컴퓨터에서 E를 누르면 실제 서버 빌드 정보를 볼 수 있어요.' },
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
    // 회의실: 테이블 주변 카펫과 엇갈린 원목 마루
    if (row >= 6 && row <= 12 && column >= 7 && column <= 17) return 2
    return (column + (row >> 1)) % 2
  }))
}
