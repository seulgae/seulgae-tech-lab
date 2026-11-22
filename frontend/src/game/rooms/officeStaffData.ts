import type { NpcDef } from '../npc/npcData.ts'

/**
 * 사무실 중앙 통로의 직원 경로와 대사, 작업석 휴식 주기를 정의한다.
 * @author seulgae
 * @version 1.0, 생활감 있는 사무실 연구원
 * @see "None"
 */
export const OFFICE_STAFF: readonly NpcDef[] = [
  { id: 'office-overtime', name: '퇴근을 기다리는 연구원', kind: 'researcher-red',
    path: [{ x: 350, y: 210 }, { x: 440, y: 210 }, { x: 440, y: 360 }, { x: 350, y: 360 }, { x: 350, y: 500 }],
    speed: 30, pause: [1800, 3200], talk: ['아, 오늘 야근 할 거 같은데… 하아.', '분명 아까까지는 잘 됐는데.', '퇴근 전에 이것만 끝내면 되는데…'] },
  { id: 'office-questions', name: '질문 많은 연구원', kind: 'researcher-bob',
    path: [{ x: 460, y: 112 }, { x: 330, y: 112 }, { x: 330, y: 270 }, { x: 460, y: 270 }, { x: 460, y: 420 }, { x: 330, y: 420 }],
    speed: 43, pause: [900, 1800], talk: ['잠깐만요! 이거 어디서 확인해요?', '아까 그 문서 링크 다시 주실 수 있어요?', '이것도 제가 하는 거 맞죠?', '혹시 이 오류 본 분 계세요?'] },
]
export const OFFICE_DESK = { x: 190, y: 228 } as const
export const OFFICE_STAND = { x: 235, y: 246 } as const

/** 24초 작업 뒤 8초 동안 일어나 한숨을 쉬고 다시 앉는다. */
export function officeDeskPhase(elapsedMs: number) { return elapsedMs % 32000 < 24000 ? 'seated' : 'standing' }
