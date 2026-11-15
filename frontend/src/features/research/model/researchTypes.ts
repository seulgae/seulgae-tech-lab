export type ResearchSummary = {
  id: string
  title: string
  summary: string
  createdAt: string
}
export type ResearchRecord = ResearchSummary & { content: string }
export type ResearchPage = { items: ResearchSummary[]; hasMore: boolean }
