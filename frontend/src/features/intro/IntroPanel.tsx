import { useEffect, useRef } from 'react'
import '../../components/panel.css'
import './intro.css'

/**
 * 첫 출근 대사와 튜토리얼 건너뛰기 선택을 보여 주는 모달이다.
 *
 * @author seulgae
 * @version 1.0, 첫 출근 안내
 * @see "None"
 * @param props 튜토리얼 선택을 게임에 전달하는 콜백
 * @returns 첫 출근 모달
 */
export default function IntroPanel({ onChoice }: { onChoice: (skip: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  /** 모달을 먼저 닫아 캔버스가 즉시 키보드 포커스를 받을 수 있게 한다. */
  const choose = (skip: boolean) => {
    dialogRef.current?.close()
    onChoice(skip)
  }

  return (
    <dialog ref={dialogRef} className="research-panel intro-panel" aria-labelledby="intro-title" aria-describedby="intro-question"
      onCancel={event => { event.preventDefault(); choose(false) }}>
      <h2 id="intro-title">첫 출근</h2>
      <p className="intro-line">
        드디어 슬개 연구소에 취업했어.<br />
        이제 나의 개발자 인생이 시작되는 거야.<br />
        이제 연구소로 들어가 볼까!!
      </p>
      <p id="intro-question">튜토리얼을 건너뛰시겠습니까?</p>
      <div className="intro-actions">
        <button type="button" className="research-close intro-guide" autoFocus onClick={() => choose(false)}>아니요, 안내받기</button>
        <button type="button" className="research-close" onClick={() => choose(true)}>네, 건너뛰기</button>
      </div>
    </dialog>
  )
}
