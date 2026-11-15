import { useEffect, useRef } from 'react'

type ResearchPanelProps = { onClose: () => void }

export default function ResearchPanel({ onClose }: ResearchPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

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
      <article className="research-entry">
        <span className="research-status">임시 기록 · 001</span>
        <h3>연구소 로비의 첫 번째 실험</h3>
        <p>컴퓨터에서 연구 기록을 열었다. 이동과 충돌에 이어 게임 오브젝트와 화면을 연결하는 실험을 진행 중이다.</p>
      </article>
      <p className="research-footer">ESC 또는 닫기 버튼으로 로비로 돌아갑니다.</p>
    </dialog>
  )
}
