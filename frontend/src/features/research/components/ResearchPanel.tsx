import { useEffect, useRef, useState } from 'react'
import { fetchResearchPage, fetchResearchRecord } from '../api/researchApi'
import type { ResearchPage, ResearchRecord } from '../model/researchTypes'
import EntryForm from '../../boards/EntryForm'
import { BoardError, IDEA_CONTENT_MAX, IDEA_TITLE_MAX, createIdea, deleteIdea, ideaTitle, nextIdeaNumber, updateIdea } from '../../boards/boardsApi'
import { LOGIN_URL, authStore, canWrite, isMine, useAuth } from '../../auth/authStore'
import './ResearchPanel.css'

type ResearchPanelProps = { onClose: () => void }
type Form = { kind: 'create'; title: string } | { kind: 'edit'; record: ResearchRecord } | null

/**
 * 연구 기록 목록·상세와, 연구 아이디어 일지 작성·수정·삭제를 제공하는 로비 컴퓨터 모달이다.
 * 일지 제목은 다음 번호("연구 아이디어 일지 #N")로 미리 채우고 내용은 130자까지 받는다.
 *
 * @author seulgae
 * @version 1.2, 제목만 보이는 목록, 카카오 로그인 글쓰기와 내 글 관리
 * @see "None"
 * @param props 패널 속성
 * @param props.onClose 패널 종료와 게임 입력 복구를 수행하는 콜백
 * @returns 연구 기록 모달
 */
export default function ResearchPanel({ onClose }: ResearchPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [page, setPage] = useState<ResearchPage>({ items: [], hasMore: false })
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ResearchRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const [form, setForm] = useState<Form>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const auth = useAuth()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  // 페이지 변경 또는 패널 해제 시 이전 요청을 중단해 늦은 응답을 무시한다.
  useEffect(() => {
    const controller = new AbortController()
    fetchResearchPage(controller.signal, offset)
      .then((data) => { if (!controller.signal.aborted) setPage(data) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [offset, retry])

  // 선택한 기록이 바뀌거나 패널이 닫히면 상세 조회 요청도 정리한다.
  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    fetchResearchRecord(selectedId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSelected(data) })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true) })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selectedId, retry])

  const retryLoad = () => {
    if (selectedId) { setDetailLoading(true); setDetailError(false) }
    else { setLoading(true); setError(false) }
    setRetry((n) => n + 1)
  }
  const openRecord = (id: string) => {
    setDetailLoading(true); setDetailError(false); setSelected(null); setActionError(null); setSelectedId(id)
  }
  const changeOffset = (next: number) => { setLoading(true); setError(false); setOffset(next) }
  /** 저장·삭제 후 첫 페이지 목록으로 돌아간다. */
  const refresh = () => { setForm(null); setSelectedId(null); setSelected(null); setLoading(true); setError(false); setOffset(0); setRetry(n => n + 1); void authStore.refreshOwned() }

  /** 다음 일지 번호를 서버에서 받아 제목을 미리 채운다. 실패하면 #1로 시작한다. */
  const startCreate = async () => {
    setActionError(null)
    const number = await nextIdeaNumber().catch(() => 1)
    setForm({ kind: 'create', title: ideaTitle(number) })
  }
  const remove = async (record: ResearchRecord) => {
    if (!window.confirm(`"${record.title}"을(를) 삭제할까요? 되돌릴 수 없어요.`)) return
    try { await deleteIdea(record.id); refresh() }
    catch (cause) { setActionError(cause instanceof BoardError ? cause.message : '삭제하지 못했어요.') }
  }

  const mine = (id: string) => isMine(auth, 'record', id)
  return (
    <dialog
      ref={dialogRef}
      className="research-panel"
      aria-labelledby="research-title"
      onCancel={(event) => {
        event.preventDefault()
        if (form) setForm(null)
        else onClose()
      }}
    >
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SEULGAE TECH LAB / ARCHIVE</p>
          <h2 id="research-title">연구 기록</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>
          닫기
        </button>
      </header>
      {form ? (
        <EntryForm titleLabel="일지 제목" titleMax={IDEA_TITLE_MAX} contentMax={IDEA_CONTENT_MAX}
          titleHint="예: 연구 아이디어 일지 #1 — 다음 번호를 미리 채워 두었어요."
          initialTitle={form.kind === 'create' ? form.title : form.record.title}
          initialContent={form.kind === 'edit' ? form.record.content : ''}
          submitLabel={form.kind === 'edit' ? '수정하기' : '등록하기'}
          onCancel={() => setForm(null)}
          onSubmit={async (title, content) => {
            if (form.kind === 'edit') await updateIdea(form.record.id, title, content)
            else await createIdea(title, content)
            refresh()
          }} />
      ) : selectedId ? (
        <section aria-live="polite" aria-busy={detailLoading}>
          <button type="button" className="research-close" onClick={() => setSelectedId(null)}>목록으로</button>
          {detailLoading && <p role="status">기록을 불러오는 중…</p>}
          {detailError && <p role="alert">기록을 불러오지 못했습니다. <button type="button" onClick={retryLoad}>다시 시도</button></p>}
          {!detailLoading && !detailError && selected && (
            <article className="research-entry">
              <span className="research-status">{new Date(selected.createdAt).toLocaleString('ko-KR')}</span>
              <h3>{selected.title}{mine(selected.id) && <span className="board-mine">내 일지</span>}</h3>
              {selected.summary !== selected.content && <p>{selected.summary}</p>}
              <p className="research-content">{selected.content}</p>
              {mine(selected.id) && canWrite(auth) && <div className="board-entry-actions">
                <button type="button" className="research-close" onClick={() => setForm({ kind: 'edit', record: selected })}>수정</button>
                <button type="button" className="research-close" onClick={() => void remove(selected)}>삭제</button>
              </div>}
              {actionError && <p role="alert" className="board-error">{actionError}</p>}
            </article>
          )}
        </section>
      ) : (
        <section aria-live="polite" aria-busy={loading}>
          <div className="board-toolbar">
            <p>떠오른 연구 아이디어를 130자로 남겨 보세요.</p>
            {canWrite(auth)
              ? <button type="button" className="research-close board-primary" onClick={() => void startCreate()}>아이디어 일지 쓰기</button>
              : <span className="board-login">글쓰기는 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></span>}
          </div>
          {loading && <p role="status">연구 기록을 불러오는 중…</p>}
          {error && <p role="alert">연구 기록을 불러오지 못했습니다. <button type="button" onClick={retryLoad}>다시 시도</button></p>}
          {!loading && !error && page.items.length === 0 && <p>아직 등록된 연구 기록이 없습니다.</p>}
          {!loading && !error && page.items.map((record) => (
            <article className="research-entry" key={record.id}>
              <span className="research-status">{new Date(record.createdAt).toLocaleString('ko-KR')}</span>
              <h3><button type="button" className="research-title" onClick={() => openRecord(record.id)}>{record.title}</button>
                {mine(record.id) && <span className="board-mine">내 일지</span>}</h3>
            </article>
          ))}
          {!loading && !error && (offset > 0 || page.hasMore) && (
            <nav className="research-pagination" aria-label="연구 기록 페이지">
              <button type="button" disabled={offset === 0} onClick={() => changeOffset(Math.max(0, offset - 10))}>이전</button>
              <button type="button" disabled={!page.hasMore || offset >= 10000} onClick={() => changeOffset(offset + 10)}>다음</button>
            </nav>
          )}
        </section>
      )}
      <p className="research-footer">ESC 또는 닫기 버튼으로 로비로 돌아갑니다. 목록의 제목을 누르면 내용을 볼 수 있어요.</p>
    </dialog>
  )
}
