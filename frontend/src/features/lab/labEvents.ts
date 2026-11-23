/** Scene과 React 사이에서 방별 상호작용 패널·테이블 대화 상태를 전달하는 이벤트 이름이다. */
export const LAB_EVENTS = {
  openPanel: 'lab:open-panel',
  /** 업무 게시판 컴퓨터를 열 때 어떤 컴퓨터(상호작용 id)인지 먼저 알린다. */
  workBoard: 'lab:work-board',
  /** 서버실 랙을 열 때 몇 번 랙(상호작용 id)인지 먼저 알린다. */
  serverRack: 'lab:server-rack',
  closePanel: 'lab:close-panel',
  tableTalk: 'lab:table-talk',
} as const
