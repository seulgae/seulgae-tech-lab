import type { RoomId } from '../maps/rooms'

/**
 * 미니 로봇 펫이 툭툭 던지는 튜토리얼 한마디. 방마다 "여기서 뭘 할 수 있는지"를 아주 짧게(20자 안팎) 알려 준다.
 * 방 팁을 먼저 다 보여 주고, 그다음에 어디서나 쓸 수 있는 팁을 섞는다.
 */
export const PET_TIPS: Record<RoomId, readonly string[]> = {
  lobby: [
    '삐빅! 문 앞에서 E로 이동해요',
    '키오스크에 인사 한마디 남겨요',
    '케이크는 HP, 커피는 기력!',
    '책장에서 책을 꺼내 읽어 봐요',
    '아래 문으로 나가면 초원이에요',
    '왼쪽 아래 문은 오락실이에요!',
  ],
  'development-lab': [
    '슈퍼컴퓨터에 아이디어를 남겨요',
    '작업대에서 빌드 정보를 봐요',
    '왼쪽 위 문은 서비스 연구실!',
    '왼쪽 아래 문은 서버실이에요',
    '오른쪽 위 문은 관리자실!',
    '작은 컴퓨터에서 관리자 신청!',
  ],
  'server-room': [
    '랙 앞에서 E! 서버 상태 확인',
    '여기 좀 춥죠? 서버실이에요',
    '로봇에게 E! 점검 비결 들어요',
  ],
  'meeting-room': [
    '여기선 다른 연구원과 만나요!',
    'Enter로 채팅할 수 있어요',
    '의자에 앉으면 테이블 대화',
    '화이트보드에 회의 안건을 써요',
    '폰 보관함에서 물고기를 교환해요',
  ],
  'control-room': [
    '관리자 전용 쿼리 콘솔이에요',
    '바꾸는 쿼리는 신중하게…!',
  ],
  outdoor: [
    '데크 끝에서 E로 낚시해요',
    '잡은 물고기는 폰 보관함에 쏙!',
    '다리로 강을 건널 수 있어요',
  ],
  'office-1': ['왼쪽 맨 아래가 내 자리예요', '내 자리 메일을 확인해요', '아이디어·QA도 내 자리에서!', '자바 연습하면 동전 1원', '오른쪽 연구원은 가끔 버럭해요'],
  'office-2': ['가운데 단말기가 대기실이에요', '방 만들고 친구를 불러요'],
  'office-3': ['벽돌 부수기 한 판에 1원!', '지치면 로비에서 커피 한 잔'],
  'office-4': ['가구점 앱에서 가구를 사 봐요', '침대는 창가가 좋겠어요'],
}

/** 어디서나 쓸 수 있는 팁 */
export const COMMON_TIPS: readonly string[] = [
  'I를 누르면 폰이 열려요',
  '화분을 흔들면 가끔 동전이!',
  '날 누르면 다른 팁을 알려 줘요',
]

/**
 * 다음 팁을 고른다. 이 방 팁 중 아직 안 본 것을 먼저, 다 봤으면 공통 팁, 그것도 다 봤으면 처음부터 다시(직전 팁은 빼고).
 * @param seen 이 방에서 이미 보여 준 팁(호출한 쪽이 기록한다)
 */
export function nextTip(roomId: RoomId, seen: readonly string[], random: () => number = Math.random): string {
  const last = seen.at(-1)
  const pick = (list: readonly string[]) => list[Math.floor(random() * list.length) % list.length]!
  const fresh = PET_TIPS[roomId].filter(tip => !seen.includes(tip))
  if (fresh.length) return pick(fresh)
  const common = COMMON_TIPS.filter(tip => !seen.includes(tip))
  if (common.length) return pick(common)
  const all = [...PET_TIPS[roomId], ...COMMON_TIPS].filter(tip => tip !== last)
  return pick(all.length ? all : PET_TIPS[roomId])
}

/** 펫이 따라갈 자리: 캐릭터가 바라보는 반대쪽 뒤, 어깨 높이(머리 위 이름표를 가리지 않게) */
export function petTarget(player: { x: number; y: number }, facingRight: boolean) {
  return { x: player.x + (facingRight ? -34 : 34), y: player.y - 10 }
}

/** 프레임 속도와 상관없이 같은 빠르기로 목표에 다가간다(지수 감쇠). */
export function follow(current: number, target: number, deltaMs: number, rate = 6) {
  return target + (current - target) * Math.exp(-rate * deltaMs / 1000)
}
