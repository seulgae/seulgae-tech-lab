import { useState } from 'react'
import type { ReactNode } from 'react'
import { listPage } from './pagination'
import './BoardPagination.css'

type NavigationProps = { label: string; page: number; pages?: number; hasNext: boolean; disabled?: boolean; onChange: (page: number) => void }

/**
 * 게시판의 이전·다음 이동과 현재 페이지를 표시한다.
 * @author seulgae
 * @version 1.0, 공통 게시판 페이지 이동
 * @see "None"
 * @param props 목록 이름, 페이지와 이동 콜백
 * @returns 키보드로 조작할 수 있는 페이지 탐색
 */
export function BoardPagination({ label, page, pages, hasNext, disabled = false, onChange }: NavigationProps) {
  return <nav className="board-pagination" aria-label={`${label} 페이지`}>
    <button type="button" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}>이전</button>
    <span aria-live="polite">{page + 1}{pages == null ? '' : ` / ${pages}`} 페이지</span>
    <button type="button" disabled={disabled || !hasNext} onClick={() => onChange(page + 1)}>다음</button>
  </nav>
}

/**
 * 조회한 목록을 5건씩 표시한다. 필터가 바뀌면 부모의 key로 첫 페이지부터 시작한다.
 * @author seulgae
 * @version 1.0, 전체 조회 목록의 공통 페이지 처리
 * @see listPage
 * @param props 목록, 목록 이름과 항목 렌더링 콜백
 * @returns 현재 목록과 이전·다음 버튼
 */
export function PagedList<T>({ items, label, children }: { items: readonly T[]; label: string; children: (items: readonly T[]) => ReactNode }) {
  const [requestedPage, setPage] = useState(0)
  const current = listPage(items, requestedPage)
  return <>
    {children(current.items)}
    <BoardPagination label={label} page={current.page} pages={current.pages} hasNext={current.page + 1 < current.pages} onChange={setPage} />
  </>
}
