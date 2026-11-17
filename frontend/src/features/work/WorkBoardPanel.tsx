import { useEffect, useRef, useState } from 'react'
import { BoardError } from '../boards/boardsApi'
import { LOGIN_URL, canWrite, useAuth } from '../auth/authStore'
import { addMaintenance, addOperation, codeName, createQa, fetchBoard, fetchThread } from './workApi'
import type { BoardView, Thread, WorkBoard, WorkItem } from './workApi'
import { playSfx } from '../../audio/AudioManager'
import { inventoryStore } from '../inventory/inventoryStore'
import '../research/components/ResearchPanel.css'
import './work.css'

const TITLES: Record<WorkBoard, { eyebrow: string; title: string; inbox: string; entries: string; help: string }> = {
  QA: { eyebrow: 'OFFICE 1 / QA', title: 'QA 게시판', inbox: '', entries: '등록한 QA와 진행 상태', help: '발견한 문제를 등록하면 2번 오피스 유지보수 게시판으로 넘어가요.' },
  MAINTENANCE: { eyebrow: 'OFFICE 2 / MAINTENANCE', title: '유지보수 게시판', inbox: '조치할 QA', entries: '유지보수 조치 기록', help: 'QA를 확인하고 조치 현황과 가이드를 남겨요. "조치 완료"로 등록하면 4번 오피스 운영 점검으로 넘어가요.' },
  OPERATION: { eyebrow: 'OFFICE 4 / OPERATION', title: '운영업무 게시판', inbox: '점검 대기', entries: '운영 점검 기록', help: '조치된 내용이 정상 동작하는지 점검하고 최종 승인해요. 반려하면 다시 유지보수로 돌아가요.' },
}
const date = (value: string) => new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * 사무실 업무 게시판(1번 QA, 2번 유지보수, 4번 운영업무). 하나의 업무 테이블을 게시판마다 자기 카테고리 기록과
 * "처리할 차례인 QA 티켓"으로 나눠 보여 준다.
 *
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 * @param props 게시판 종류와 닫기 콜백
 * @returns 업무 게시판 모달
 */
export default function WorkBoardPanel({ board, onClose }: { board: WorkBoard; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [view, setView] = useState<BoardView | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [guide, setGuide] = useState('')
  const auth = useAuth()
  const text = TITLES[board]

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetchBoard(board, controller.signal).then(setView).catch(() => { if (!controller.signal.aborted) setError('게시판을 불러오지 못했어요.') })
    return () => controller.abort()
  }, [board, reload])

  const status = (item: WorkItem) => view ? codeName(view.statuses, item.status) : item.status
  const category = (item: WorkItem) => view ? codeName(view.categories, item.category) : item.category
  const open = async (id: string) => {
    setError(null); setContent(''); setGuide('')
    try { setThread(await fetchThread(id)) } catch { setError('내용을 불러오지 못했어요.') }
  }
  const run = async (action: () => Promise<unknown>, done: string) => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      await action()
      playSfx('success', { volume: 0.6 })
      setTitle(''); setContent(''); setGuide('')
      setReload(n => n + 1)
      // 회원 게시물은 10원 보상(하루 한도 안): 가방을 다시 읽으면 늘어난 만큼 동전이 튀어 오른다.
      void inventoryStore.refresh()
      if (thread) setThread(await fetchThread(thread.ticket.id))
      setError(done)
    } catch (cause) {
      playSfx('error', { volume: 0.5 })
      setError(cause instanceof BoardError && cause.status === 409 ? '이미 다른 단계로 넘어간 티켓이에요. 목록을 새로 확인해 주세요.'
        : cause instanceof BoardError ? cause.message : '저장하지 못했어요.')
    } finally { setBusy(false) }
  }
  const writable = canWrite(auth)
  const ticket = thread?.ticket
  const canMaintain = board === 'MAINTENANCE' && ticket && ['REGISTERED', 'IN_PROGRESS', 'REJECTED'].includes(ticket.status)
  const canOperate = board === 'OPERATION' && ticket?.status === 'RESOLVED'

  return (
    <dialog ref={dialogRef} className="research-panel work-panel" aria-labelledby="work-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">{text.eyebrow}</p>
          <h2 id="work-title">{text.title}</h2>
          <p className="work-help">{text.help}</p>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      {error && <p className="work-message" role="status">{error}</p>}
      {!writable && <p className="board-login">글쓰기는 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>}

      {thread ? (
        <section className="work-thread" aria-label="티켓 상세">
          <button type="button" onClick={() => setThread(null)}>← 목록</button>
          <article className={`work-ticket status-${thread.ticket.status}`}>
            <span className="work-badge">{status(thread.ticket)}</span>
            <h3>{thread.ticket.title}</h3>
            <p>{thread.ticket.content}</p>
            <small>QA 등록 · {date(thread.ticket.createdAt)}</small>
          </article>
          <ol className="work-records">
            {thread.records.map(record => (
              <li key={record.id} className={`work-record category-${record.category}`}>
                <span className="work-badge">{category(record)} · {status(record)}</span>
                <p>{record.content}</p>
                {record.guide && <p className="work-guide"><strong>가이드</strong> {record.guide}</p>}
                <small>{date(record.createdAt)}</small>
              </li>
            ))}
          </ol>
          {canMaintain && writable && (
            <form className="work-form" onSubmit={event => event.preventDefault()}>
              <label>조치 현황<textarea maxLength={1000} value={content} onChange={event => setContent(event.target.value)} required /></label>
              <label>가이드(선택)<textarea maxLength={1000} value={guide} onChange={event => setGuide(event.target.value)} /></label>
              <div className="work-actions">
                <button type="button" disabled={busy || !content.trim()} onClick={() => void run(() => addMaintenance(ticket!.id, content, guide, false), '조치 현황을 남겼어요.')}>조치 중으로 기록</button>
                <button type="button" className="board-primary" disabled={busy || !content.trim()} onClick={() => void run(() => addMaintenance(ticket!.id, content, guide, true), '조치 완료! 4번 오피스 운영 점검으로 넘겼어요.')}>조치 완료(운영 점검 요청)</button>
              </div>
            </form>
          )}
          {canOperate && writable && (
            <form className="work-form" onSubmit={event => event.preventDefault()}>
              <label>점검 결과<textarea maxLength={1000} value={content} onChange={event => setContent(event.target.value)} required /></label>
              <div className="work-actions">
                <button type="button" disabled={busy || !content.trim()} onClick={() => void run(() => addOperation(ticket!.id, content, false), '반려했어요. 2번 오피스 유지보수로 돌아가요.')}>반려</button>
                <button type="button" className="board-primary" disabled={busy || !content.trim()} onClick={() => void run(() => addOperation(ticket!.id, content, true), '최종 승인했어요.')}>최종 승인</button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <>
          {board === 'QA' && writable && (
            <form className="work-form" onSubmit={event => { event.preventDefault(); void run(() => createQa(title, content), 'QA를 등록했어요. 2번 오피스 유지보수 게시판으로 넘어갔어요.') }}>
              <label>제목<input maxLength={60} value={title} onChange={event => setTitle(event.target.value)} required /></label>
              <label>내용<textarea maxLength={1000} value={content} onChange={event => setContent(event.target.value)} required /></label>
              <button type="submit" className="board-primary" disabled={busy || !title.trim() || !content.trim()}>QA 등록</button>
            </form>
          )}
          {board !== 'QA' && (
            <section aria-label={text.inbox}>
              <h3 className="work-heading">{text.inbox} <span>{view?.inbox.length ?? 0}</span></h3>
              {view && view.inbox.length === 0 && <p className="work-empty">처리할 티켓이 없어요.</p>}
              <ul className="work-list">
                {view?.inbox.map(item => (
                  <li key={item.id}><button type="button" onClick={() => void open(item.id)}>
                    <span className="work-badge">{status(item)}</span> {item.title} <small>{date(item.createdAt)}</small>
                  </button></li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label={text.entries}>
            <h3 className="work-heading">{text.entries} <span>{view?.entries.length ?? 0}</span></h3>
            {!view && !error && <p role="status">불러오는 중…</p>}
            {view && view.entries.length === 0 && <p className="work-empty">아직 기록이 없어요.</p>}
            <ul className="work-list">
              {view?.entries.map(item => (
                <li key={item.id}><button type="button" onClick={() => void open(item.id)}>
                  <span className="work-badge">{status(item)}</span> {item.title} <small>{date(item.createdAt)}</small>
                </button></li>
              ))}
            </ul>
          </section>
        </>
      )}
      <p className="research-footer">ESC 또는 닫기 버튼으로 돌아갑니다. 목록을 누르면 티켓의 전체 흐름을 볼 수 있어요.</p>
    </dialog>
  )
}
