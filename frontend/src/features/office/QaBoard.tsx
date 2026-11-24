import { useEffect, useState } from 'react'
import { PagedList } from '../boards/BoardPagination'
import { BoardError } from '../boards/boardsApi'
import { LOGIN_URL, canWrite, useAuth } from '../auth/authStore'
import { playSfx } from '../../audio/AudioManager'
import { TIRED_STATUS, inventoryStore } from '../inventory/inventoryStore'
import { tiredMessage } from '../rules/rulesStore'
import { QA_FLOW, QA_NEXT, createQa, fetchQa, moveQa } from './officeApi'
import type { QaStatus, QaTicket } from './officeApi'
import '../boards/boards.css'
import './office.css'

const date = (value: string) => new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const NAMES: Record<QaStatus, string> = { REGISTERED: '등록', IN_PROGRESS: '조치 중', RESOLVED: '조치 완료' }

/**
 * QA 게시판 본문: 문제를 등록하고, 티켓을 펼쳐 조치 중 → 조치 완료로 한 단계씩 넘긴다(되돌리기 없음).
 * 내 자리 컴퓨터의 QA 아이콘 창에서 연다. 회원 등록·상태 변경마다 HP·기력(운영 규칙 tb_lab_action_cost), 동전 10원(하루 10번).
 *
 * @author 길태형
 * @version 1.0, 게시판 개편(내 자리 컴퓨터 아이콘)
 * @see "None"
 * @returns 게시판 본문
 */
export function QaBoard() {
  const auth = useAuth()
  const [tickets, setTickets] = useState<QaTicket[] | null>(null)
  const [filter, setFilter] = useState<QaStatus | 'ALL'>('ALL')
  const [open, setOpen] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const writable = canWrite(auth)

  useEffect(() => { fetchQa().then(setTickets).catch(() => setMessage('게시판을 불러오지 못했어요.')) }, [])

  /* 서버 요청 하나를 실행하고 목록의 해당 티켓을 바꾼다. */
  const run = async (action: () => Promise<QaTicket>, done: string) => {
    if (busy) return false
    setBusy(true)
    try {
      const ticket = await action()
      setTickets(list => [ticket, ...(list ?? []).filter(item => item.id !== ticket.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setOpen(ticket.id); setMessage(done); playSfx('success', { volume: 0.6 }); void inventoryStore.refresh()
      return true
    } catch (cause) {
      playSfx('error', { volume: 0.5 })
      setMessage(cause instanceof BoardError && cause.status === TIRED_STATUS ? tiredMessage('QA_REGISTER')
        : cause instanceof BoardError && cause.status === 409 ? '이미 다음 단계로 넘어간 티켓이에요. 창을 다시 열어 확인해 주세요.'
        : cause instanceof BoardError ? cause.message : '저장하지 못했어요.')
      return false
    } finally { setBusy(false) }
  }

  const register = async () => {
    if (!title.trim() || !content.trim()) return
    if (await run(() => createQa(title, content), 'QA를 등록했어요.')) { setTitle(''); setContent('') }
  }

  const shown = (tickets ?? []).filter(ticket => filter === 'ALL' || ticket.status === filter)
  const count = (status: QaStatus) => tickets?.filter(ticket => ticket.status === status).length ?? 0

  return (
    <div className="office-board">
      <p className="work-help">발견한 문제를 등록하고, 처리하면서 조치 중 → 조치 완료로 넘겨요. 단계는 앞으로만 갈 수 있어요.</p>
      {message && <p className="work-message" role="status">{message}</p>}
      {writable ? (
        <form className="work-form" onSubmit={event => { event.preventDefault(); void register() }}>
          <label>제목<input maxLength={60} value={title} onChange={event => setTitle(event.target.value)} required /></label>
          <label>내용<textarea maxLength={1000} value={content} onChange={event => setContent(event.target.value)} required /></label>
          <button type="submit" className="board-primary" disabled={busy || !title.trim() || !content.trim()}>QA 등록</button>
        </form>
      ) : <p className="board-login">등록·조치는 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>}

      {/* 상태별로 걸러 보기 */}
      <div className="qa-filter" role="radiogroup" aria-label="상태">
        <button type="button" role="radio" aria-checked={filter === 'ALL'} onClick={() => setFilter('ALL')}>전체 {tickets?.length ?? 0}</button>
        {QA_FLOW.map(status => <button key={status} type="button" role="radio" aria-checked={filter === status} onClick={() => setFilter(status)}>{NAMES[status]} {count(status)}</button>)}
      </div>
      {!tickets && !message && <p role="status">불러오는 중…</p>}
      {tickets && shown.length === 0 && <p className="work-empty">해당하는 티켓이 없어요.</p>}
      <PagedList key={filter} items={shown} label="QA 티켓">{visible => <ul className="work-list">
        {visible.map(ticket => {
          const next = QA_NEXT[ticket.status]
          return (
            <li key={ticket.id} className={`status-${ticket.status}`}>
              <button type="button" aria-expanded={open === ticket.id} onClick={() => setOpen(open === ticket.id ? null : ticket.id)}>
                <span className="work-badge">{ticket.statusName}</span> {ticket.title} <small>{ticket.author ?? '익명'} · {date(ticket.createdAt)}</small>
              </button>
              {open === ticket.id && (
                <div className="work-body">
                  <ol className="qa-steps" aria-label="진행 단계">
                    {QA_FLOW.map(status => <li key={status} className={QA_FLOW.indexOf(status) <= QA_FLOW.indexOf(ticket.status) ? 'done' : ''}>{NAMES[status]}</li>)}
                  </ol>
                  <p>{ticket.content}</p>
                  {ticket.updatedAt && <small>마지막 변경 {date(ticket.updatedAt)}</small>}
                  {next && writable && (
                    <div className="work-actions">
                      <button type="button" className="board-primary" disabled={busy} onClick={() => void run(() => moveQa(ticket.id, next.status), `${NAMES[next.status]}(으)로 넘겼어요.`)}>{next.label}</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>}</PagedList>
    </div>
  )
}
