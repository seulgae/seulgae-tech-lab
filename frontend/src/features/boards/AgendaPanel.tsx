import { BoardPagination } from './BoardPagination'
import { BOARD_PAGE_SIZE } from './pagination'
import { useEffect, useRef, useState } from 'react'
import EntryForm from './EntryForm'
import {
  AGENDAS_CHANGED, AGENDA_CONTENT_MAX, AGENDA_TITLE_MAX, BoardError, createAgenda, deleteAgenda, fetchAgendas, updateAgenda,
} from './boardsApi'
import type { Agenda } from './boardsApi'
import '../research/components/ResearchPanel.css'
import { LOGIN_URL, authStore, canWrite, isMine, useAuth } from '../auth/authStore'

type Mode = { kind: 'list' } | { kind: 'view'; agenda: Agenda } | { kind: 'create' } | { kind: 'edit'; agenda: Agenda }

/**
 * 회의실 화이트보드 안건 목록과 작성·수정·삭제. 제목은 칠판 한 줄에 맞춰 8자, 내용은 130자까지다.
 *
 * @author seulgae
 * @version 1.2, 안건을 5건씩 이전·다음 페이지로 표시
 * @see "None"
 * @param props 닫기 콜백
 * @returns 안건 모달
 */
export default function AgendaPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<Agenda[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [reload, setReload] = useState(0)
  const auth = useAuth()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchAgendas(controller.signal, BOARD_PAGE_SIZE, offset)
      .then(page => { if (!controller.signal.aborted) { if (page.items.length === 0 && offset > 0) { setOffset(Math.max(0, offset - BOARD_PAGE_SIZE)); return }; setItems(page.items); setHasMore(page.hasMore); setError(null) } })
      .catch(() => { if (!controller.signal.aborted) setError('안건을 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [offset, reload])

  /** 저장 후 목록·칠판을 함께 갱신한다. */
  const changed = () => { setMode({ kind: 'list' }); setOffset(0); setLoading(true); setReload(n => n + 1); window.dispatchEvent(new Event(AGENDAS_CHANGED)); void authStore.refreshOwned() }
  const remove = async (agenda: Agenda) => {
    if (!window.confirm(`"${agenda.title}" 안건을 삭제할까요? 되돌릴 수 없어요.`)) return
    try { await deleteAgenda(agenda.id); changed() }
    catch (cause) { setError(cause instanceof BoardError ? cause.message : '삭제하지 못했어요.') }
  }

  return (
    <dialog ref={dialogRef} className="research-panel" aria-labelledby="agenda-title"
      onCancel={event => { event.preventDefault(); if (mode.kind === 'list') onClose(); else setMode({ kind: 'list' }) }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SEULGAE TECH LAB / MEETING ROOM</p>
          <h2 id="agenda-title">회의 안건</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose}>닫기</button>
      </header>
      {mode.kind === 'list' ? (
        <section aria-live="polite" aria-busy={loading}>
          <div className="board-toolbar">
            <p>최신 안건 제목이 화이트보드에 표시돼요.</p>
            {canWrite(auth)
              ? <button type="button" className="research-close board-primary" onClick={() => setMode({ kind: 'create' })} autoFocus>안건 쓰기</button>
              : <span className="board-login">글쓰기는 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></span>}
          </div>
          {loading && <p role="status">안건을 불러오는 중…</p>}
          {error && <p role="alert" className="board-error">{error} <button type="button" onClick={() => { setLoading(true); setError(null); setReload(n => n + 1) }}>다시 시도</button></p>}
          {!loading && !error && items.length === 0 && <p>아직 안건이 없어요. 첫 안건을 적어 보세요.</p>}
          {/* 목록에는 제목만 보이고, 누르면 내용을 연다. */}
          {!loading && !error && items.map(agenda => (
            <article className="research-entry" key={agenda.id}>
              <span className="research-status">{new Date(agenda.createdAt).toLocaleString('ko-KR')}{agenda.updatedAt ? ' · 수정됨' : ''}</span>
              <h3><button type="button" className="research-title" onClick={() => setMode({ kind: 'view', agenda })}>{agenda.title}</button>
                {isMine(auth, 'agenda', agenda.id) && <span className="board-mine">내 안건</span>}</h3>
            </article>
          ))}
          <BoardPagination label="회의 안건" page={offset / BOARD_PAGE_SIZE} hasNext={hasMore && offset < 10000} disabled={loading || !!error}
            onChange={page => { setLoading(true); setError(null); setOffset(page * BOARD_PAGE_SIZE) }} />
        </section>
      ) : mode.kind === 'view' ? (
        <section>
          <button type="button" className="research-close" onClick={() => setMode({ kind: 'list' })}>목록으로</button>
          <article className="research-entry">
            <span className="research-status">{new Date(mode.agenda.createdAt).toLocaleString('ko-KR')}{mode.agenda.updatedAt ? ' · 수정됨' : ''}</span>
            <h3>{mode.agenda.title}{isMine(auth, 'agenda', mode.agenda.id) && <span className="board-mine">내 안건</span>}</h3>
            <p className="research-content">{mode.agenda.content}</p>
            {isMine(auth, 'agenda', mode.agenda.id) && canWrite(auth) && <div className="board-entry-actions">
              <button type="button" className="research-close" onClick={() => setMode({ kind: 'edit', agenda: mode.agenda })}>수정</button>
              <button type="button" className="research-close" onClick={() => void remove(mode.agenda)}>삭제</button>
            </div>}
            {error && <p role="alert" className="board-error">{error}</p>}
          </article>
        </section>
      ) : (
        <EntryForm titleLabel="안건 제목" titleMax={AGENDA_TITLE_MAX} contentMax={AGENDA_CONTENT_MAX}
          titleHint="화이트보드 한 줄에 보이도록 8자까지 쓸 수 있어요."
          initialTitle={mode.kind === 'edit' ? mode.agenda.title : ''} initialContent={mode.kind === 'edit' ? mode.agenda.content : ''}
          submitLabel={mode.kind === 'edit' ? '수정하기' : '등록하기'}
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (title, content) => {
            if (mode.kind === 'edit') await updateAgenda(mode.agenda.id, title, content)
            else await createAgenda(title, content)
            changed()
          }} />
      )}
      <p className="research-footer">{auth.kakaoEnabled ? '내가 쓴 안건만 수정·삭제할 수 있어요.' : '이 브라우저에서 쓴 안건만 수정·삭제할 수 있어요.'}</p>
    </dialog>
  )
}
