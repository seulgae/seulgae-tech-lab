import { useEffect, useRef, useState } from 'react'
import EntryForm from './EntryForm'
import {
  AGENDAS_CHANGED, AGENDA_CONTENT_MAX, AGENDA_TITLE_MAX, BoardError, createAgenda, deleteAgenda, editToken, fetchAgendas, updateAgenda,
} from './boardsApi'
import type { Agenda } from './boardsApi'
import '../research/components/ResearchPanel.css'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; agenda: Agenda }

/**
 * 회의실 화이트보드 안건 목록과 작성·수정·삭제. 제목은 칠판 한 줄에 맞춰 8자, 내용은 130자까지다.
 *
 * @author seulgae
 * @version 1.0, 회의 안건 패널
 * @see "None"
 * @param props 닫기 콜백
 * @returns 안건 모달
 */
export default function AgendaPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<Agenda[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchAgendas(controller.signal, limit)
      .then(page => { if (!controller.signal.aborted) { setItems(page.items); setHasMore(page.hasMore); setError(null) } })
      .catch(() => { if (!controller.signal.aborted) setError('안건을 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [limit, reload])

  /** 저장 후 목록·칠판을 함께 갱신한다. */
  const changed = () => { setMode({ kind: 'list' }); setReload(n => n + 1); window.dispatchEvent(new Event(AGENDAS_CHANGED)) }
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
            <button type="button" className="research-close board-primary" onClick={() => setMode({ kind: 'create' })} autoFocus>안건 쓰기</button>
          </div>
          {loading && <p role="status">안건을 불러오는 중…</p>}
          {error && <p role="alert" className="board-error">{error}</p>}
          {!loading && !error && items.length === 0 && <p>아직 안건이 없어요. 첫 안건을 적어 보세요.</p>}
          {items.map(agenda => (
            <article className="research-entry" key={agenda.id}>
              <span className="research-status">{new Date(agenda.createdAt).toLocaleString('ko-KR')}{agenda.updatedAt ? ' · 수정됨' : ''}</span>
              <h3>{agenda.title}{editToken(agenda.id) && <span className="board-mine">내 안건</span>}</h3>
              <p className="research-content">{agenda.content}</p>
              {editToken(agenda.id) && <div className="board-entry-actions">
                <button type="button" className="research-close" onClick={() => setMode({ kind: 'edit', agenda })}>수정</button>
                <button type="button" className="research-close" onClick={() => void remove(agenda)}>삭제</button>
              </div>}
            </article>
          ))}
          {hasMore && <nav className="research-pagination"><button type="button" onClick={() => setLimit(value => Math.min(50, value + 10))}>더 보기</button></nav>}
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
      <p className="research-footer">로그인이 없어서, 이 브라우저에서 쓴 안건만 수정·삭제할 수 있어요.</p>
    </dialog>
  )
}
