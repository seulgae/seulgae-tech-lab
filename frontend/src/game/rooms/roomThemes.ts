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
    notes: { title: '어서 오세요,\n연구원님.', body: '대리석 로비에서\n오늘의 탐험을 시작해요.', missionTitle: '안내 데스크와 방명록', mission: '키오스크에서 E로 방명록에 인사를 남기고, 양옆 네 문으로 각 연구실에, 아래 문으로 바깥 초원에 나가 보세요.' },
  },
  'development-lab': {
    mood: '어두운 네이비 위에 네온 그린 모니터가 빛나는 해커 연구실',
    camera: '#0a0f19', light: '#39e6b4',
    floor: { base: '#141c2b', baseLine: '#1a2436', alt: '#152033', altLine: '#1f4d6b', accent: '#121a28', accentLine: '#0c1320', accentDetail: '#39e6b4' },
    wall: { upper: '#1b2538', upperLight: '#26344d', lower: '#0f1522', lowerDark: '#0a0f19', trim: '#39e6b4', detail: '#38bdf8', side: '#0f1522', bottom: '#0a0f19' },
    door: { frame: '#0a0f19', frameLight: '#38bdf8', panel: '#1b2538', panelLight: '#2b3a55', handle: '#39e6b4', sign: '#39e6b4' },
    page: { background: '#0a1019', card: '#101827', border: '#24405a', accent: '#39e6b4', muted: '#8fb3c9' },
    textures: { computer: 'dev-desk', chair: 'gaming-chair', equipment: 'workbench' },
    notes: { title: '빌드는\n멈추지 않아요.', body: '네온 모니터 앞에서\n코드를 다듬는 곳입니다.', missionTitle: 'CI 파이프라인', mission: '개발 연구원들의 로비예요. 왼쪽 위는 서비스 연구실, 오른쪽 위는 관리자실(관리자만, 앞의 작은 컴퓨터에서 신청), 오른쪽 아래는 회의실, 왼쪽 아래는 서버실이에요. 가운데 슈퍼컴퓨터에서 연구 아이디어를 등록하고, 작업대에서 실제 서버 빌드 정보를 볼 수 있어요.' },
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
    mood: '월넛 벽과 버건디 카펫, 금빛 장식 사이에 운영 DB 슈퍼컴퓨터가 한 대 있는 관리자실',
    camera: '#120b0a', light: '#e7c66f',
    floor: { base: '#4a1f24', baseLine: '#3d191d', alt: '#521f26', altLine: '#3a171b', accent: '#5e2830', accentLine: '#46191f', accentDetail: '#c9a24b' },
    wall: { upper: '#3b2418', upperLight: '#5a3a2a', lower: '#24150f', lowerDark: '#160d09', trim: '#c9a24b', detail: '#e7c66f', side: '#2e1c13', bottom: '#1a100b' },
    door: { frame: '#160d09', frameLight: '#c9a24b', panel: '#4a2c1e', panelLight: '#6b4430', handle: '#e7c66f', sign: '#c9a24b' },
    page: { background: '#140c0a', card: '#211512', border: '#5a3a2a', accent: '#e7c66f', muted: '#c8ab8e' },
    // 슈퍼컴퓨터는 공유 맵에 전용 텍스처 키(supercomputer)로 들어 있다.
    textures: { chair: 'armchair', rack: 'bookshelf' },
    notes: { title: '관리자만\n들어올 수 있어요.', body: '운영 DB를 직접\n살피는 곳입니다.', missionTitle: '쿼리 콘솔', mission: '가운데 슈퍼컴퓨터에서 E를 누르면 쿼리 콘솔이 열려요. 왼쪽 테이블 이름을 누르면 조회 쿼리가 들어가고, 바꾸는 쿼리는 실행 전에 한 번 더 확인해요.' },
  },
  'office-1': {
    mood: '창문과 회색 사무용 타일, 좌우 대칭 책상 사이로 연구원들이 오가는 사무실',
    camera: '#333d45', light: '#edf5ff',
    floor: { base: '#c0c7cc', baseLine: '#aab3ba', alt: '#c7cdd1', altLine: '#b0b9bf', accent: '#c0c7cc', accentLine: '#aab3ba', accentDetail: '#c7cdd1' },
    wall: { upper: '#e4eaed', upperLight: '#f6f8fa', lower: '#73828c', lowerDark: '#52616b', trim: '#a5b6bf', detail: '#879da9', side: '#73828c', bottom: '#52616b' },
    door: { frame: '#5a3f2a', frameLight: '#c4a57a', panel: '#9c7a55', panelLight: '#b8936a', handle: '#e7d29a', sign: '#5a6f8c' },
    page: { background: '#1b1814', card: '#28221b', border: '#5c4d3b', accent: '#e8c48a', muted: '#c8b89f' },
    textures: { computer: 'office-desk', chair: 'office-chair', rack: 'bookshelf', equipment: 'workbench', plant: 'tall-plant' },
    notes: { title: '서비스 연구실', body: '아이디어를 모으고\n버그를 고치는 곳.', missionTitle: '아이디어 · QA · 내 자리', mission: '왼쪽 열 맨 아래가 내 자리 컴퓨터예요. 바탕화면 아이콘으로 메일(오늘 할 업무), 아이디어 기획 게시판, QA 게시판(등록 → 조치 중 → 조치 완료), 개발(자바 printf 연습)을 열어요. 다른 자리에서는 연구원들이 일하고 있어요. 글 하나에 동전 10원!' },
  },
  'office-2': {
    mood: '모든 연구원이 모여 유즈맵을 함께하는 네온 라운지(어두운 바닥, 청록 격자, 보랏빛 조명)',
    camera: '#05060f', light: '#67e8f9',
    floor: { base: '#0e1226', baseLine: '#1b2a4a', alt: '#111633', altLine: '#203457', accent: '#1b1240', accentLine: '#3b1f6e', accentDetail: '#22d3ee' },
    wall: { upper: '#160f2e', upperLight: '#2a1a52', lower: '#0b0a1f', lowerDark: '#070614', trim: '#22d3ee', detail: '#a855f7', side: '#0f0b24', bottom: '#070614' },
    door: { frame: '#070614', frameLight: '#22d3ee', panel: '#1e1b4b', panelLight: '#312e81', handle: '#f0abfc', sign: '#22d3ee' },
    page: { background: '#070816', card: '#0f1228', border: '#3b2f7a', accent: '#67e8f9', muted: '#c4b5fd' },
    textures: { computer: 'dev-desk', chair: 'office-chair', plant: 'tall-plant' },
    notes: { title: '협동\n연구실', body: '모두 모이는\n유즈맵 라운지.', missionTitle: '유즈맵 라운지', mission: '모든 연구원이 모여 함께 노는 네온 라운지예요. 들어오면 대기실 창이 열려요. 방을 만들거나 들어가서, 방장이 맵을 고르고 시작해요. 소파에서 쉬다가 가운데 단말기에서 E로 대기실을 다시 열 수 있어요. 첫 맵은 협동 버그 잡기!' },
  },
  'office-3': {
    mood: '네온이 번쩍이는 보랏빛 오락실(월루 전용 휴게 공간)',
    camera: '#0a0414', light: '#f472b6',
    floor: { base: '#1c1030', baseLine: '#140a24', alt: '#241540', altLine: '#1a0e30', accent: '#2a1450', accentLine: '#1f0e3c', accentDetail: '#38bdf8' },
    wall: { upper: '#1a0e2e', upperLight: '#2a1748', lower: '#0f0820', lowerDark: '#090414', trim: '#f472b6', detail: '#38bdf8', side: '#140a24', bottom: '#090414' },
    door: { frame: '#090414', frameLight: '#f472b6', panel: '#2a1748', panelLight: '#3d2466', handle: '#ffd23f', sign: '#38bdf8' },
    page: { background: '#0c0616', card: '#170c28', border: '#4c2a7a', accent: '#f472b6', muted: '#c4b5fd' },
    textures: { computer: 'arcade-machine', chair: 'arcade-stool', rack: 'arcade-cabinet', equipment: 'claw-machine', plant: 'tall-plant' },
    notes: { title: '오락실', body: '잠깐 쉬어 가요.\n최고 점수에 도전!', missionTitle: '벽돌 부수기', mission: '가운데 큰 오락기에서 E를 누르면 벽돌 부수기를 할 수 있어요. 최고 점수는 이 브라우저에 남아요.' },
  },
  'office-4': {
    mood: '내 가구로 꾸미는 개인 기숙사 방',
    camera: '#14181d', light: '#e3efff',
    floor: { base: '#c9a77c', baseLine: '#b08d63', alt: '#d2b088', altLine: '#b8966c', accent: '#3f6b7a', accentLine: '#335a67', accentDetail: '#7fb3c4' },
    wall: { upper: '#e6edf2', upperLight: '#f4f8fa', lower: '#4f6472', lowerDark: '#3a4b56', trim: '#9cb5c4', detail: '#6f8796', side: '#4f6472', bottom: '#3a4b56' },
    door: { frame: '#3a4b56', frameLight: '#9cb5c4', panel: '#6f8796', panelLight: '#8aa2b0', handle: '#e7d29a', sign: '#3f6b7a' },
    page: { background: '#12161a', card: '#1b2228', border: '#3e4f5b', accent: '#8fc4d9', muted: '#a9bac4' },
    textures: { computer: 'dev-desk', chair: 'office-chair', rack: 'bookshelf', equipment: 'workbench', plant: 'tall-plant' },
    notes: { title: '개인 기숙사', body: '나만 보는 내 방.\n가구로 꾸며 봐요.', missionTitle: '방 꾸미기', mission: '폰의 가구점 앱에서 동전으로 가구를 사고, 보관함 가구 탭에서 배치를 눌러 E로 놓아요. 놓은 가구 앞에서 E를 누르면 다시 보관함으로 들어가요.' },
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
      // 슈퍼컴퓨터 양옆 의자로 이어지는 네온 케이블 덕트와 4칸 격자
      if (row === 12 || (row >= 9 && row <= 12 && (column === 9 || column === 15))) return 2
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
      // 연구소 문 앞은 문 폭(3칸)만큼 흙길을 넓혀 잔디가 보이지 않게 한다.
      if (row >= 15 && column >= 11 && column <= 13) return 2
      if (row === 10 && column >= 12 && column <= 20) return 2
      return (row * 7 + column * 3) % 5 === 0 ? 1 : 0
    }
    if (roomId === 'office-1') {
      // 카펫 없이 같은 계열의 회색 사무용 타일을 엇갈려 깐다.
      return (row + column) % 5 === 0 ? 1 : 0
    }
    // 회의실: 테이블 주변 카펫과 엇갈린 원목 마루
    if (row >= 4 && row <= 14 && column >= 8 && column <= 16) return 2
    return (column + (row >> 1)) % 2
  }))
}
