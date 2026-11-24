/**
 * 화면에만 사는 NPC들. 정해진 길(장애물을 피해 그린 순환 경로)을 천천히 오가며, E로 말을 걸면 한마디 한다.
 * 바깥 시민 셋은 지친 직장인을 위로하고, 로비 청소 아주머니는 돌아다니며 궁시렁거린다.
 */
export type NpcKind = 'woman' | 'man' | 'elder' | 'cleaner' | 'guard' | 'kid-boy' | 'kid-girl' | 'fisher' | 'professor' | 'researcher-woman' | 'researcher-man' | 'researcher-silver' | 'researcher-curly' | 'researcher-bob' | 'researcher-red' | 'robot'
/** 연구원 픽셀 외형: 기존 시민·박사 외형과 독립된 가운 직원 변형이다. */
export const RESEARCHER_STYLES = [
  { kind: 'researcher-woman', hair: '#8a5a3c', skin: '#f3c9a8', shirt: '#f7d4dd', badge: '#e05a6c', style: 'long', glasses: false },
  { kind: 'researcher-man', hair: '#1f1a18', skin: '#e8b98f', shirt: '#7fb89a', badge: '#2f6fed', style: 'short', glasses: true },
  { kind: 'researcher-silver', hair: '#bac6d1', skin: '#c58c67', shirt: '#80a6ce', badge: '#c596e0', style: 'short', glasses: true },
  { kind: 'researcher-curly', hair: '#b3783b', skin: '#eac29f', shirt: '#efbc72', badge: '#d37848', style: 'curly', glasses: false },
  { kind: 'researcher-bob', hair: '#463b62', skin: '#edb6a0', shirt: '#ae96cf', badge: '#5baeb1', style: 'bob', glasses: true },
  { kind: 'researcher-red', hair: '#9e4e45', skin: '#d59e76', shirt: '#8db6aa', badge: '#a984ce', style: 'long', glasses: false },
] as const

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
  /** 서 있는 동안에도 두 프레임을 천천히 번갈아(낚싯대 흔들기 등) */
  idle?: boolean
  /** 처음 자리를 경로의 첫 지점으로 고정(제자리 NPC) */
  fixed?: boolean
  /** 의자에 앉아 컴퓨터를 향해 일하는 고정 자세 */
  seated?: boolean
  /** 바라보는 방향(제자리 NPC): true면 오른쪽 */
  facesRight?: boolean
  /** 일하다가 화가 나서 내뱉는 말(작업석 연구원). Npc.vent()가 쓴다. */
  angry?: readonly string[]
  /** 개발 연구실 빌드 결과에 따른 반응(실패하면 놀라고, 성공하면 웃는다) */
  reactions?: { fail: readonly string[]; pass: readonly string[] }
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
    // 포장마차(가운데 풀밭)를 돌아 위쪽 풀밭과 바위 옆으로 걷는다.
    // 낚시 데크(x 594~642, y 200~240)와 낚시꾼 왼쪽으로 돌아 걷는다.
    path: [{ x: 380, y: 170 }, { x: 556, y: 168 }, { x: 548, y: 290 }, { x: 470, y: 300 }, { x: 400, y: 300 }],
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
  {
    id: 'npc-kid-boy', kind: 'kid-boy', name: '뛰어노는 아이',
    path: [{ x: 170, y: 500 }, { x: 250, y: 478 }, { x: 245, y: 535 }, { x: 160, y: 545 }],
    speed: 78, pause: [300, 1200],
    talk: [
      '아저씨 오늘도 일했어요? 대단해요!',
      '어른 되면 매일 회의해요? 으악!',
      '힘들면 그냥 낮잠 자요! 저처럼요!',
      '같이 술래잡기 할래요? 제가 술래!',
    ],
    mutter: ['잡아 봐라~!', '히히, 못 잡지롱!', '야, 기다려!'],
  },
  {
    id: 'npc-kid-girl', kind: 'kid-girl', name: '뛰어노는 아이',
    path: [{ x: 230, y: 540 }, { x: 155, y: 505 }, { x: 205, y: 470 }, { x: 270, y: 505 }],
    speed: 70, pause: [300, 1400],
    talk: [
      '언니 오빠들은 왜 맨날 피곤해요?',
      '이거 제가 주운 네잎클로버예요! 행운!',
      '일 끝나면 꼭 놀아야 해요. 약속!',
      '엄마가 그러는데 웃으면 덜 힘들대요!',
    ],
    mutter: ['꺄르르!', '나 잡아 봐!', '같이 놀자~'],
  },
  {
    id: 'npc-fisher', kind: 'fisher', name: '낚시하는 아저씨',
    // 데크 아래쪽 물가에 서서 강을 향해 낚싯대를 드리운다(데크 낚시 자리는 비워 둔다).
    path: [{ x: 575, y: 300 }], speed: 0, pause: [600000, 600000], idle: true, fixed: true, facesRight: true,
    talk: [
      '낚시는 기다림이야. 일도 그렇지.',
      '찌가 쑥 들어가면 그때 E를 눌러.',
      '오늘 못 잡아도 괜찮아. 바람 쐬러 온 거니까.',
      '퇴근하고 물 보는 게 제일 좋아.',
    ],
    mutter: ['오늘은 입질이 영 없네…', '어제 잡은 메기가 이~만 했는데…', '쉿… 물고기 도망간다…', '흠, 미끼를 바꿔 볼까…', '황금 잉어는 대체 언제 나오나…'],
  },
]

export const LOBBY_NPCS: readonly NpcDef[] = [
  {
    id: 'npc-cleaner', kind: 'cleaner', name: '청소 아주머니',
    path: [{ x: 240, y: 300 }, { x: 400, y: 280 }, { x: 520, y: 300 }, { x: 520, y: 460 }, { x: 400, y: 480 }, { x: 250, y: 460 }],
    speed: 50, pause: [1200, 2600],
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
  {
    id: 'npc-lobby-guard', kind: 'guard', name: '경비 아저씨', fixed: true,
    // 출입문과 방명록 컴퓨터는 비우고 입구 안쪽을 순찰한다.
    path: [{ x: 300, y: 420 }, { x: 470, y: 420 }, { x: 470, y: 500 }, { x: 300, y: 500 }],
    speed: 58, pause: [1200, 2200],
    talk: [
      '왔으면 방명록 좀 작성해 주세요!!',
      '오른쪽 컴퓨터가 방명록이에요. 이름 남기셨죠?',
      '뛰지 말고요! 방명록은 꼭 쓰고 가세요.',
    ],
    mutter: [
      '왔으면 방명록 좀 작성해 주세요!!',
      '방명록 안 쓰고 슬쩍 들어가면 다 보여요~',
      '연구원님, 방문 기록은 남기고 가셔야죠!',
      '오른쪽 컴퓨터에서 방명록 작성 부탁해요!',
    ],
  },

]

/**
 * 오락실 단골 다섯: 돈을 잃고 절망하거나 따고 신나는 사람들. 오락기·책상·소파를 피해 걷거나 제자리에 서 있다.
 *
 * @author 길태형
 * @version 1.0, 오락실 단골 NPC
 * @see None
 */
export const ARCADE_NPCS: readonly NpcDef[] = [
  {
    id: 'npc-arcade-allin', kind: 'man', name: '올인 아저씨', fixed: true, facesRight: true,
    path: [{ x: 90, y: 480 }], speed: 0, pause: [3000, 6000],
    talk: ['한 판만… 딱 한 판만 더 하면 본전이야.', '자네도 홀짝 해 봤나? 다음엔 무조건 짝이야.', '월급날까지 며칠 남았더라…'],
    mutter: ['아… 또 홀이야…', '내 동전… 내 동전 돌려줘…', '이번 달 커피값까지 다 날렸네…', '다음 판은 진짜 온다. 느낌이 와.'],
  },
  {
    id: 'npc-arcade-jackpot', kind: 'researcher-man', name: '대박난 연구원',
    path: [{ x: 270, y: 370 }, { x: 530, y: 370 }, { x: 520, y: 470 }, { x: 280, y: 470 }],
    speed: 58, pause: [800, 1800],
    talk: ['방금 사다리 세 번 연속 맞혔어요! 오늘 제 날이에요!', '커피 쏩니다! 아, 커피는 2원이구나…', '감이 왔을 때 멈춰야… 아니 한 판만 더!'],
    mutter: ['대박!! 두 배다 두 배!', '하하, 오늘은 뭘 해도 된다!', '이 기세로 주식도 사 볼까?', '역시 짝이었어! 내 촉!'],
  },
  {
    id: 'npc-arcade-sigh', kind: 'researcher-silver', name: '한숨 쉬는 선배', fixed: true,
    path: [{ x: 290, y: 250 }], speed: 0, pause: [3000, 6000],
    talk: ['후배야, 여기 오래 있지 마라. 시간도 동전도 녹는다.', '적금이나 들 걸 그랬어…', '나도 처음엔 재미로 시작했지.'],
    mutter: ['하아…', '사다리가 왜 꼭 반대로 내려가지…', '적금 깨서 왔는데…', '집에 뭐라고 하지…'],
  },
  {
    id: 'npc-arcade-lucky', kind: 'researcher-curly', name: '신난 인턴', fixed: true,
    path: [{ x: 710, y: 480 }], speed: 0, pause: [3000, 6000],
    talk: ['처음 왔는데 벌써 땄어요! 원래 이렇게 쉬운 거예요?', '언니, 이거 어떻게 하는 거예요? 아 이미 땄다!', '초심자의 행운이래요!'],
    mutter: ['꺄! 또 맞았다!', '이거 완전 내 적성인데?', '오늘 점심은 내가 쏜다!', '어? 이번엔 졌네… 괜찮아 다시!'],
  },
  {
    id: 'npc-arcade-elder', kind: 'elder', name: '사다리 할아버지',
    path: [{ x: 270, y: 140 }, { x: 530, y: 140 }],
    speed: 34, pause: [2500, 5000],
    talk: ['젊은이, 사다리는 말이야… 그냥 운이야, 운.', '나 때는 동전 하나로 하루 종일 놀았어.', '잃어도 웃을 수 있을 만큼만 하게나.'],
    mutter: ['허허, 오늘은 영 안 풀리는구먼.', '왼쪽이었어야 했는데…', '그래도 재밌으면 됐지, 허허.', '어이쿠! 이번엔 맞혔다!'],
  },
]

export const DEV_LAB_NPCS: readonly NpcDef[] = [
  {
    id: 'npc-professor', kind: 'professor', name: '괴짜 박사님',
    // 슈퍼컴퓨터 앞 의자와 가운데 작업대 사이를 돌며 연구한다.
    path: [{ x: 180, y: 340 }, { x: 620, y: 340 }, { x: 620, y: 460 }, { x: 470, y: 470 }, { x: 330, y: 470 }, { x: 180, y: 460 }],
    speed: 34, pause: [2000, 4500],
    talk: [
      '빌드는 실패의 어머니라네!',
      'E=mc²… 아니, 여기선 E가 상호작용 키지.',
      '가설을 세우고, 테스트하고, 또 테스트하게.',
      '커피는 연구의 연료라네. 물도 마시고.',
      '재현이 되면 반은 고친 거야!',
    ],
    mutter: [
      '흠… 이 버그는 양자 상태인가…',
      '재현이 안 되면 버그가 아니라 유령이야…',
      '테스트 커버리지를 조금만 더…',
      '로그에 답이 있어… 분명히…',
      '캐시를 지우면 되려나…',
      '어제는 됐는데… 어제는…',
    ],
    reactions: {
      fail: ['으아악! 빌드가 깨졌어!', '이럴 수가! 테스트가 빨갛잖아!', '누가 main에 바로 푸시했나?!'],
      pass: ['유레카! 빌드 성공이다!', '하하하! 모든 테스트 통과!', '봤나? 이것이 과학이야!'],
    },
  },
]

/** 포장마차: 저녁 6시~자정에만 연다(서버도 같은 시간에만 산다). */
/** 서버 용량 조사를 어떻게 만들었는지 쓴 블로그 글(서버실 로봇이 안내한다) */
export const SERVER_BLOG_URL = 'https://seulgae.github.io/blog/jsch-to-mina-sshd'

const robot = (id: string, name: string, path: { x: number; y: number }[], mutter: string[]): NpcDef => ({
  id: `server-robot-${id}`, kind: 'robot', name, path, speed: 26, pause: [1800, 4200], mutter,
  talk: ['삐빅, 서버 점검 이야기 들려 드릴게요!', '제가 어떻게 숫자를 모으는지 궁금하세요?', 'SSH로 30초마다 물어봐요. 삐빅.'],
})

/**
 * 서버실 관리 로봇 다섯. 랙(y 172~260)과 장비(y 344~400)를 피해 랙 앞 통로(y 300), 아래 통로(y 470), 가운데 기둥 길(x 400)을 순찰한다.
 */
export const SERVER_ROBOTS: readonly NpcDef[] = [
  robot('temp', '온도 관리 로봇', [{ x: 90, y: 300 }, { x: 340, y: 300 }], ['랙 온도 18°C, 정상. 삐빅.', '흡기 온도 확인 완료.', '뜨거운 공기는 위로, 찬 공기는 앞으로!']),
  robot('fan', '팬 관리 로봇', [{ x: 460, y: 300 }, { x: 710, y: 300 }], ['팬 회전수 점검 중… 위잉.', '먼지 필터 교체까지 12일.', '팬 소리, 오늘도 고르다.']),
  robot('backup', '백업 관리 로봇', [{ x: 400, y: 130 }, { x: 400, y: 290 }], ['DB 백업 무결성 확인 완료.', 'pg_dump 파일, 잘 보관 중.', '마이그레이션 전엔 꼭 백업! 삐빅.']),
  robot('log', '로그 관리 로봇', [{ x: 80, y: 470 }, { x: 320, y: 470 }], ['로그 파일 압축 중…', '경고 로그 0건. 평화롭다.', 'capacity 수집 성공 로그 확인!']),
  robot('security', '보안 관리 로봇', [{ x: 480, y: 470 }, { x: 720, y: 470 }], ['known_hosts 지문 대조 완료.', '이 키로는 측정 스크립트만 실행 가능.', '수상한 접속 시도 없음. 삐빅.']),
]

export const CART_OPEN_HOUR = 18
export const CART_SPOT = { x: 490, bottom: 270 }
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
