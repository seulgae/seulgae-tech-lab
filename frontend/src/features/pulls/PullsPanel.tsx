import { useEffect, useRef, useState } from 'react'
import { PagedList } from '../boards/BoardPagination'
import { ago, fetchPulls } from './pullsApi'
import type { Pull, Pulls } from './pullsApi'
import '../../components/panel.css'
import './pulls.css'

/**
 * 개발 연구실 슈퍼컴퓨터: GitHub PR 목록. 열린 PR과 최근 머지된 PR을 탭으로 나눠 5건씩 보여 주고, 누르면 GitHub에서 연다.
 *
 * @author seulgae
 * @version 1.0, GitHub PR 목록
 * @see "None"
 * @param props 닫기 콜백
 * @returns PR 목록 모달
 */
export default function PullsPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<Pulls | null>(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'open' | 'merged'>('open')

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetchPulls(controller.signal).then(setData).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [])

  const list = data ? data[tab] : []
  return (
    <dialog ref={dialogRef} className="research-panel pulls-panel" aria-labelledby="pulls-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">DEVELOPMENT LAB / GITHUB</p>
          <h2 id="pulls-title">PR 목록</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <div className="pulls-tabs" role="tablist" aria-label="PR 종류">
        {([['open', '열린 PR'], ['merged', '최근 머지']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}{data ? ` ${data[key].length}` : ''}
          </button>
        ))}
      </div>
      {!data && !error && <p role="status">GitHub에서 불러오는 중…</p>}
      {error && <p role="alert">PR 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>}
      {data?.stale && <p className="pulls-note" role="status">GitHub에 지금 닿지 않아 {data.fetchedAt ? '이전에 받아 온' : '빈'} 목록을 보여 줘요.</p>}
      {data && list.length === 0 && <p className="pulls-note">{tab === 'open' ? '열린 PR이 없어요.' : '최근 머지된 PR이 없어요.'}</p>}
      {data && list.length > 0 && (
        <PagedList key={tab} items={list} label={tab === 'open' ? '열린 PR' : '최근 머지'}>
          {(page: readonly Pull[]) => (
            <ul className="pulls-list">
              {page.map(p => (
                <li key={p.number}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    <span className="pulls-number">#{p.number}</span>
                    <span className="pulls-title">{p.title}</span>
                    <span className="pulls-meta">
                      {p.draft && <em>Draft</em>}
                      {p.author ?? '알 수 없음'} · {tab === 'open' ? `${ago(p.createdAt)} 열림` : `${ago(p.mergedAt)} 머지`}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </PagedList>
      )}
      <p className="research-footer">{data ? `${data.repo} · 5분마다 새로 받아 와요` : ''} · ESC로 닫기</p>
    </dialog>
  )
}
