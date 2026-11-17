import { useEffect, useRef, useState } from 'react'
import { BoardError } from '../boards/boardsApi'
import { LOGIN_URL, canWrite, useAuth } from '../auth/authStore'
import { GUESTBOOK_CONTENT_MAX, GUESTBOOK_TITLE_MAX, charCount, clip, fetchGuestbook, validEntry, writeGuestbook } from './guestbookApi'
import type { GuestbookEntry } from './guestbookApi'
import { playSfx } from '../../audio/AudioManager'
import '../research/components/ResearchPanel.css'
import './guestbook.css'

const date = (value: string) => new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * 로비 컴퓨터의 방명록. 들어오는 사람이 짧은 인사(제목 8자, 내용 130자)를 남긴다.
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 * @param props 닫기 콜백
 * @returns 방명록 모달
 */
export default function GuestbookPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [reload, setReload] = useState(0)
  const auth = useAuth()
  const writable = canWrite(auth)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetchGuestbook(controller.signal).then(setEntries).catch(() => { if (!controller.signal.aborted) setMessage('방명록을 불러오지 못했어요.') })
    return () => controller.abort()
  }, [reload])

  const submit = async () => {
    if (busy || !validEntry(title, content)) return
    setBusy(true); setMessage(null)
    try {
      await writeGuestbook(title, content)
      playSfx('success', { volume: 0.6 })
      setTitle(''); setContent('')
      setMessage('인사를 남겼어요. 반가워요!')
      setReload(n => n + 1)
    } catch (cause) {
      playSfx('error', { volume: 0.5 })
      setMessage(cause instanceof BoardError ? cause.message : '저장하지 못했어요.')
    } finally { setBusy(false) }
  }

  return (
    <dialog ref={dialogRef} className="research-panel guestbook-panel" aria-labelledby="guestbook-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SEULGAE TECH LAB / LOBBY</p>
          <h2 id="guestbook-title">방명록</h2>
          <p className="guestbook-help">연구소에 들른 김에 인사 한마디 남겨 주세요.</p>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      {message && <p className="guestbook-message" role="status">{message}</p>}
      {writable ? (
        <form className="guestbook-form" onSubmit={event => { event.preventDefault(); void submit() }}>
          <label>제목 <small>{charCount(title)}/{GUESTBOOK_TITLE_MAX}</small>
            <input value={title} onChange={event => setTitle(clip(event.target.value, GUESTBOOK_TITLE_MAX))} placeholder="안녕하세요" required />
          </label>
          <label>인사 <small>{charCount(content)}/{GUESTBOOK_CONTENT_MAX}</small>
            <textarea value={content} rows={3} onChange={event => setContent(clip(event.target.value, GUESTBOOK_CONTENT_MAX))} placeholder="오늘 처음 와 봤어요!" required />
          </label>
          <button type="submit" className="board-primary" disabled={busy || !validEntry(title, content)}>남기기</button>
        </form>
      ) : <p className="board-login">인사 남기기는 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>}

      <section aria-label="방명록 목록">
        {!entries && !message && <p role="status">불러오는 중…</p>}
        {entries && entries.length === 0 && <p className="guestbook-empty">아직 인사가 없어요. 첫 인사를 남겨 주세요.</p>}
        <ul className="guestbook-list">
          {entries?.map(entry => (
            <li key={entry.id}>
              <strong>{entry.title}</strong>
              <p>{entry.content}</p>
              <small>{entry.author ?? '손님'} · {date(entry.createdAt)}</small>
            </li>
          ))}
        </ul>
      </section>
      <p className="research-footer">ESC 또는 닫기 버튼으로 돌아갑니다. 연구 아이디어는 개발 연구실 슈퍼컴퓨터에서 볼 수 있어요.</p>
    </dialog>
  )
}
