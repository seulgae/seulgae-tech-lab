export type ResearchSummary = {
  id: string
  title: string
  summary: string
  createdAt: string
  /** 완료 표시. 누구나 체크·해제하는 공유 상태다. 상세 응답에는 없다. */
  done?: boolean
}
export type ResearchRecord = ResearchSummary & { content: string }
export type ResearchPage = { items: ResearchSummary[]; hasMore: boolean }
