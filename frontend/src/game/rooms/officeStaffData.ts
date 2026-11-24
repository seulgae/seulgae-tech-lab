import type { NpcDef } from '../npc/npcData.ts'

/**
 * 사무실 중앙 통로의 직원 경로와 대사, 작업석 휴식 주기를 정의한다.
 * @author seulgae
 * @version 1.1, 사무실 이동 직원의 보행 속도와 정지 시간 조정
 * @see "None"
 */
export const OFFICE_STAFF: readonly NpcDef[] = [
  { id: 'office-overtime', name: '퇴근을 기다리는 연구원', kind: 'researcher-red',
    path: [{ x: 350, y: 210 }, { x: 440, y: 210 }, { x: 440, y: 360 }, { x: 350, y: 360 }, { x: 350, y: 500 }],
    speed: 52, pause: [1000, 1800], talk: ['아, 오늘 야근 할 거 같은데… 하아.', '분명 아까까지는 잘 됐는데.', '퇴근 전에 이것만 끝내면 되는데…'] },
  { id: 'office-questions', name: '질문 많은 연구원', kind: 'researcher-bob',
    path: [{ x: 460, y: 112 }, { x: 330, y: 112 }, { x: 330, y: 270 }, { x: 460, y: 270 }, { x: 460, y: 420 }, { x: 330, y: 420 }],
    speed: 68, pause: [500, 1100], talk: ['잠깐만요! 이거 어디서 확인해요?', '아까 그 문서 링크 다시 주실 수 있어요?', '이것도 제가 하는 거 맞죠?', '혹시 이 오류 본 분 계세요?'] },
]
export const OFFICE_DESK = { x: 190, y: 228 } as const
export const OFFICE_STAND = { x: 235, y: 246 } as const

/** 24초 작업 뒤 8초 동안 일어나 한숨을 쉬고 다시 앉는다. */
export function officeDeskPhase(elapsedMs: number) { return elapsedMs % 32000 < 24000 ? 'seated' : 'standing' }

/* 작업석 연구원이 일하다가 화가 나서 내뱉는 말 */
const ANGRY = [
  '아 왜 또 빌드가 깨져!', '이 버그 누가 만들었어!!', '회의 또 잡혔어?!', 'NullPointerException… 또 너냐!',
  '금요일 배포하자고 한 사람 누구야!', '커피 떨어졌잖아…!', '테스트는 왜 나만 깨지는데!', '이거 어제는 됐다고!!',
]
/* 말을 걸면 일하면서 하는 대답 */
const BUSY = ['지금 좀 바빠요… 그래도 고마워요.', '이것만 고치고 커피 마시러 가요.', '손이 키보드에서 안 떨어지네요.', '아까 소리 질러서 미안해요…']

/**
 * 서비스 연구실 작업석 연구원 넷: 오른쪽 열 셋(위·가운데·아래)과 왼쪽 가운데 QA 자리 하나.
 * 왼쪽 위 아이디어 자리는 officeLifeFx의 막힌 연구원이, 왼쪽 아래는 내 자리(플레이어 컴퓨터)다.
 * 채용 업무 화면을 없앤 뒤 일반 직원으로 바꿨다: 일하다가 가끔 화가 나서 한마디 한다.
 */
export const OFFICE_DESK_WORKERS: readonly NpcDef[] = ([
  { id: 'office-desk-top', name: '집중하는 연구원', kind: 'researcher-woman', x: 610, y: 228 },
  { id: 'office-desk-middle', name: '디버깅하는 연구원', kind: 'researcher-man', x: 610, y: 378 },
  { id: 'office-desk-bottom', name: '배포 담당 연구원', kind: 'researcher-silver', x: 610, y: 528 },
  { id: 'office-desk-qa', name: 'QA 담당 연구원', kind: 'researcher-red', x: 190, y: 378 },
] as const).map(worker => ({
  id: worker.id, kind: worker.kind, name: worker.name, path: [{ x: worker.x, y: worker.y }],
  fixed: true, seated: true, idle: true, speed: 0, pause: [600000, 600000] as const, talk: BUSY, angry: ANGRY,
}))
