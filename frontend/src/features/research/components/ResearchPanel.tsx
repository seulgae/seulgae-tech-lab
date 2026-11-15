import { useEffect, useRef, useState } from 'react'
import { fetchResearchPage, fetchResearchRecord } from '../api/researchApi'
import type { ResearchPage, ResearchRecord } from '../model/researchTypes'
import './ResearchPanel.css'

type ResearchPanelProps = { onClose: () => void }

/**
 * 연구 기록 목록·상세 조회와 로딩·오류·재시도 상태를 표시하는 모달이다.
 *
 * @author seulgae
 * @version 1.0, 연구 기록 조회 패널과 요청 정리 책임 문서화
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

  /**
   * 현재 목록 또는 상세 화면의 오류 상태를 초기화하고 조회를 다시 시도한다.
   */
  const retryLoad = () => {
    if (selectedId) { setDetailLoading(true); setDetailError(false) }
    else { setLoading(true); setError(false) }
    setRetry((n) => n + 1)
  }
  /**
   * 이전 상세 결과를 비우고 선택한 연구 기록을 조회한다.
   *
   * @param id 조회할 연구 기록 식별자
   */
  const openRecord = (id: string) => {
    setDetailLoading(true)
    setDetailError(false)
    setSelected(null)
    setSelectedId(id)
  }
  /**
   * 목록 로딩 상태를 초기화하고 조회 페이지를 변경한다.
   *
   * @param next 다음 목록 조회에서 건너뛸 기록 수
   */
  const changeOffset = (next: number) => {
    setLoading(true)
    setError(false)
    setOffset(next)
  }

  return (
    <dialog
      ref={dialogRef}
      className="research-panel"
      aria-labelledby="research-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
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
      {selectedId ? (
        <section aria-live="polite" aria-busy={detailLoading}>
          <button type="button" className="research-close" onClick={() => setSelectedId(null)}>목록으로</button>
          {detailLoading && <p role="status">기록을 불러오는 중…</p>}
          {detailError && <p role="alert">기록을 불러오지 못했습니다. <button type="button" onClick={retryLoad}>다시 시도</button></p>}
          {!detailLoading && !detailError && selected && (
            <article className="research-entry">
              <span className="research-status">{new Date(selected.createdAt).toLocaleString('ko-KR')}</span>
              <h3>{selected.title}</h3>
              <p>{selected.summary}</p>
              <p className="research-content">{selected.content}</p>
            </article>
          )}
        </section>
      ) : (
        <section aria-live="polite" aria-busy={loading}>
          {loading && <p role="status">연구 기록을 불러오는 중…</p>}
          {error && <p role="alert">연구 기록을 불러오지 못했습니다. <button type="button" onClick={retryLoad}>다시 시도</button></p>}
          {!loading && !error && page.items.length === 0 && <p>아직 등록된 연구 기록이 없습니다.</p>}
          {!loading && !error && page.items.map((record) => (
            <article className="research-entry" key={record.id}>
              <span className="research-status">{new Date(record.createdAt).toLocaleString('ko-KR')}</span>
              <h3><button type="button" className="research-title" onClick={() => openRecord(record.id)}>{record.title}</button></h3>
              <p>{record.summary}</p>
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
      <p className="research-footer">ESC 또는 닫기 버튼으로 로비로 돌아갑니다.</p>
    </dialog>
  )
}
