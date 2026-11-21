/**
 * 화면에만 사는 NPC들. 정해진 길(장애물을 피해 그린 순환 경로)을 천천히 오가며, E로 말을 걸면 한마디 한다.
 * 바깥 시민 셋은 지친 직장인을 위로하고, 로비 청소 아주머니는 돌아다니며 궁시렁거린다.
 */
export type NpcKind = 'woman' | 'man' | 'elder' | 'cleaner'
export type NpcDef = {
  id: string
  kind: NpcKind
  name: string
  /** 순환 경로(월드 좌표, 발밑 기준). 호수·강·가구를 피해 그렸다. */
  path: readonly { x: number; y: number }[]
  /** 걷는 빠르기(px/초) */
  speed: number
  /** 경로 지점에서 쉬는 시간(ms) 범위 */
  pause: readonly [number, number]
  /** E로 말 걸면 하는 말 */
  talk: readonly string[]
  /** 혼자 중얼거리는 말(있으면 가끔 말풍선) */
  mutter?: readonly string[]
}

export const OUTDOOR_NPCS: readonly NpcDef[] = [
  {
    id: 'npc-woman', kind: 'woman', name: '산책하는 시민',
    path: [{ x: 110, y: 362 }, { x: 300, y: 366 }, { x: 360, y: 420 }, { x: 200, y: 446 }],
    speed: 42, pause: [1500, 4000],
    talk: [
      '오늘도 출근하느라 고생 많았어요.',
      '당신 진짜 잘하고 있어요, 정말로요.',
      '커피 말고 물도 한 잔 마셔요!',
      '퇴근하면 맛있는 거 꼭 먹어요.',
      '힘든 날은 일찍 자는 게 최고예요.',
    ],
  },
  {
    id: 'npc-man', kind: 'man', name: '퇴근한 시민',
    path: [{ x: 400, y: 200 }, { x: 560, y: 200 }, { x: 600, y: 270 }, { x: 420, y: 340 }],
    speed: 52, pause: [1000, 3000],
    talk: [
      '회의 많았죠? 숨 좀 돌려요.',
      '월급날까지 조금만 더 힘내요!',
      '버그는 내일의 나에게 맡깁시다.',
      '야근보다 산책이 생산성에 좋대요.',
      '오늘 한 일, 충분히 대단해요.',
    ],
  },
  {
    id: 'npc-elder', kind: 'elder', name: '동네 어르신',
    path: [{ x: 120, y: 142 }, { x: 250, y: 152 }, { x: 420, y: 122 }, { x: 250, y: 152 }],
    speed: 22, pause: [3000, 6000],
    talk: [
      '젊을 때 고생은… 그래도 쉬면서 해.',
      '밥은 꼭 챙겨 먹고 다니게.',
      '호수 보면서 한숨 돌리고 가.',
      '자네 같은 사람 덕에 세상이 돌아가.',
      '너무 애쓰지 마. 내일도 해가 뜬다네.',
    ],
  },
]

export const LOBBY_NPCS: readonly NpcDef[] = [
  {
    id: 'npc-cleaner', kind: 'cleaner', name: '청소 아주머니',
    path: [{ x: 240, y: 300 }, { x: 400, y: 280 }, { x: 520, y: 300 }, { x: 520, y: 460 }, { x: 400, y: 480 }, { x: 250, y: 460 }],
    speed: 30, pause: [2500, 5500],
    talk: [
      '어머 연구원님, 오늘도 수고 많아요~',
      '바닥 미끄러우니까 조심해요!',
      '밥은 먹고 일하는 거지? 응?',
      '아휴, 이 연구소는 다들 너무 바빠.',
    ],
    mutter: [
      '아이고, 또 커피 흘렸네…',
      '발자국 좀 봐. 방금 닦았는데…',
      '누가 케이크 부스러기를 여기다…',
      '허리야… 그래도 반짝반짝해야지.',
      '책은 제자리에 꽂아 두라니까…',
      '궁시렁궁시렁… 아무도 안 듣지?',
    ],
  },
]

/** 포장마차: 저녁 6시~자정에만 연다(서버도 같은 시간에만 산다). */
export const CART_OPEN_HOUR = 18
export const CART_SPOT = { x: 400, bottom: 344 }
export const cartOpenAt = (date: Date) => date.getHours() >= CART_OPEN_HOUR

/** 같은 말을 바로 반복하지 않고 고른다. */
export function pickLine(lines: readonly string[], last: string | undefined, random: () => number = Math.random) {
  const choices = lines.length > 1 ? lines.filter(line => line !== last) : lines
  return choices[Math.floor(random() * choices.length) % choices.length]!
}

/** 다음 경로 지점까지 한 걸음. 도착하면 arrived=true */
export function stepToward(from: { x: number; y: number }, to: { x: number; y: number }, speed: number, deltaMs: number) {
  const dx = to.x - from.x, dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  const step = speed * deltaMs / 1000
  if (distance <= step) return { x: to.x, y: to.y, arrived: true }
  return { x: from.x + dx / distance * step, y: from.y + dy / distance * step, arrived: false }
}
