import { useEffect, useRef, useState } from 'react'
import { LOGIN_URL, useAuth } from '../auth/authStore'
import { LEVEL_NAMES, REASON_MAX, REQUEST_STATUS_NAMES, applyLevel, fetchMyLevel } from './levelApi'
import type { MyLevel } from './levelApi'
import { playSfx } from '../../audio/AudioManager'
import '../research/components/ResearchPanel.css'
import './sqlConsole.css'

/**
 * 관리자실 앞 작은 컴퓨터: 운영자(2)·관리자(3) 등급을 신청한다. 관리자가 관리자실 쿼리 콘솔에서 승인하면 등급이 오른다.
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 * @param props 닫기 콜백
 * @returns 등급 신청 모달
 */
export default function AdminApplyPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const auth = useAuth()
  const [mine, setMine] = useState<MyLevel | null>(null)
  const [level, setLevel] = useState(3)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => { if (auth.member) fetchMyLevel().then(setMine).catch(cause => setMessage(cause instanceof Error ? cause.message : '불러오지 못했어요.')) }, [auth.member])

  const submit = async () => {
    if (busy || !reason.trim()) return
    setBusy(true); setMessage(null)
    try {
      const request = await applyLevel(level, reason)
      setMine(previous => ({ level: previous?.level ?? 1, request }))
      setReason('')
      setMessage('신청했어요! 관리자가 관리자실에서 확인할 거예요.')
      playSfx('success', { volume: 0.6 })
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '신청하지 못했어요.')
      playSfx('error', { volume: 0.5 })
    } finally { setBusy(false) }
  }

  const current = mine?.level ?? 1
  const pending = mine?.request?.status === 'PENDING'
  const choices = [2, 3].filter(value => value > current)

  return (
    <dialog ref={dialogRef} className="research-panel admin-apply" aria-labelledby="admin-apply-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">MINI TERMINAL · ADMIN ROOM</p>
          <h2 id="admin-apply-title">관리자 신청</h2>
          <p className="sql-help">등급: 1 일반 사용자 · 2 운영자 · 3 관리자. 관리자(3)는 옆 관리자실에 들어갈 수 있어요.</p>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      {!auth.member && <p className="board-login">신청은 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>}
      {auth.member && (
        <>
          <p className="admin-apply-level">지금 등급: <strong>{LEVEL_NAMES[current] ?? current}</strong></p>
          {mine?.request && (
            <p className={`admin-apply-status status-${mine.request.status}`}>
              최근 신청: {LEVEL_NAMES[mine.request.requestedLevel]} · <strong>{REQUEST_STATUS_NAMES[mine.request.status]}</strong>
            </p>
          )}
          {message && <p className="sql-help" role="status">{message}</p>}
          {choices.length === 0 && <p className="sql-help">이미 가장 높은 등급이에요.</p>}
          {choices.length > 0 && !pending && (
            <form className="admin-apply-form" onSubmit={event => { event.preventDefault(); void submit() }}>
              <label>신청 등급
                <select value={choices.includes(level) ? level : choices[0]} onChange={event => setLevel(Number(event.target.value))}>
                  {choices.map(value => <option key={value} value={value}>{value} · {LEVEL_NAMES[value]}</option>)}
                </select>
              </label>
              <label>사유 <small>{Array.from(reason).length}/{REASON_MAX}</small>
                <textarea value={reason} maxLength={REASON_MAX} rows={3} onChange={event => setReason(event.target.value)} placeholder="어떤 일을 돕고 싶은지 적어 주세요" required />
              </label>
              <button type="submit" className="board-primary" disabled={busy || !reason.trim()}>{busy ? '신청 중…' : '신청하기'}</button>
            </form>
          )}
          {pending && <p className="sql-help">검토 중인 신청이 있어요. 결과가 나오면 다시 신청할 수 있어요.</p>}
        </>
      )}
    </dialog>
  )
}
