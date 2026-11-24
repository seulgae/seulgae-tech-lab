import { useEffect, useRef, useState } from 'react'
import { getAudioSettings, effectiveVolume } from '../../audio/audioSettings'
import { muteRoomAudio } from '../../audio/AudioManager'
import '../../components/panel.css'
import './ending.css'

const LINES = [
  '소장도 달고 돈도 많이 벌고 게임에서 모든 업적을 이루고 만족하셨나요?',
  '이제는 우리 현생으로 돌아가서 주변을 정돈하고 합시다.',
  '이제 슬개 연구소를 퇴사합니다. 고생하셨습니다.',
] as const

/**
 * 야외 표지판에서 시스템 관리자와 대화하고, 환생 기록을 저장한 뒤 엔딩 크레딧을 재생한다.
 *
 * @author seulgae
 * @version 1.0, 시스템 관리자 대화와 엔딩 크레딧
 * @see "None"
 * @param props 로비 패널 닫기 콜백
 * @returns 엔딩 대화 또는 영상 모달
 */
export default function EndingPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [status, setStatus] = useState<{ eligible: boolean; reborn: boolean } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/ending', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (response.status === 401) {
        setError('엔딩은 로그인한 연구소장만 시작할 수 있어요.')
      } else if (response.ok) {
        setStatus(await response.json())
      } else {
        throw new Error('Ending status unavailable')
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError('엔딩 자격을 확인하지 못했어요. 표지판을 다시 열어 주세요.')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (step !== 3 || !video || finished) return
    const restoreRoomAudio = muteRoomAudio()
    video.volume = effectiveVolume(getAudioSettings(), 'bgm')
    video.muted = video.volume === 0
    void video.play().catch(() => { /* 자동 재생이 막히면 영상의 재생 버튼을 사용한다. */ })
    return () => { video.pause(); restoreRoomAudio() }
  }, [step, finished])

  /** 마지막 대화에서 자격을 다시 확인한 뒤 영상 화면으로 이동한다. */
  const complete = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/ending/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (response.ok) setStep(3)
      else if (response.status === 403) setError('현재 직급 또는 잔액이 조건에 맞지 않아요. 표지판에서 다시 확인해 주세요.')
      else if (response.status === 401) setError('다시 로그인한 뒤 시도해 주세요.')
      else throw new Error('Ending completion unavailable')
    } catch {
      setError('환생 기록을 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="research-panel ending-panel" aria-labelledby="ending-title"
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
      <header className="research-panel-header">
        <div>
          <h2 id="ending-title">{step === 3 ? '엔딩 크레딧' : '시스템 관리자'}</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} disabled={busy}>닫기</button>
      </header>
      <div className="ending-content">
        {step === 3 ? <>
          <video ref={videoRef} playsInline controls preload="metadata" aria-label="슬개기술연구소 엔딩 크레딧"
            src={`${import.meta.env.BASE_URL}media/ending-credits.mp4`}
            onPlay={() => setFinished(false)} onEnded={() => setFinished(true)}
            onError={() => { setFinished(true); setError('영상을 불러오지 못했어요. 표지판에서 다시 재생할 수 있어요.') }} />
          {finished && <button type="button" className="ending-primary" onClick={onClose}>연구소로 돌아가기</button>}
        </> : <>
          {!status && !error && <p role="status">엔딩 자격을 확인하고 있어요.</p>}
          {status && !status.eligible && <p>연구소장이고 지갑에 100,000원 이상 있을 때 대화를 시작할 수 있어요.</p>}
          {status?.eligible && <>
            <p className="ending-line" aria-live="polite">{LINES[step]}</p>
            {step === 0 && <div className="ending-actions">
              <button type="button" className="ending-primary" onClick={() => setStep(1)}>네</button>
              <button type="button" className="research-close" onClick={onClose}>아니요</button>
            </div>}
            {step === 1 && <button type="button" className="ending-primary" onClick={() => setStep(2)}>다음</button>}
            {step === 2 && <button type="button" className="ending-primary" disabled={busy} onClick={() => void complete()}>
              {busy ? '저장 중…' : status.reborn ? '영상 다시 보기' : '다음 · 엔딩 보기'}
            </button>}
          </>}
        </>}
        {error && <p role="alert">{error}</p>}
      </div>
    </dialog>
  )
}
