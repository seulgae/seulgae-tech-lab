import { useState } from 'react'
import { BoardError, countChars } from './boardsApi'
import './boards.css'

type Props = {
  titleLabel: string; titleMax: number; contentMax: number
  initialTitle?: string; initialContent?: string; submitLabel: string
  titleHint?: string
  onSubmit: (title: string, content: string) => Promise<unknown>
  onCancel: () => void
}

/**
 * 제목·내용 입력 폼. 글자 수는 서버와 같은 코드 포인트 기준으로 세고, 넘으면 전송을 막는다.
 * 게임 키(WASD·E)가 입력창에서 Phaser로 전달되지 않도록 키 이벤트 전파를 막는다.
 *
 * @author seulgae
 * @version 1.0, 안건·아이디어 일지 공통 입력
 * @see "None"
 */
export default function EntryForm({ titleLabel, titleMax, contentMax, initialTitle = '', initialContent = '', submitLabel, titleHint, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleCount = countChars(title), contentCount = countChars(content)
  const valid = titleCount >= 1 && titleCount <= titleMax && !/[\r\n]/.test(title.trim()) && contentCount >= 1 && contentCount <= contentMax

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true); setError(null)
    try { await onSubmit(title.trim(), content.trim()) }
    catch (cause) { setError(cause instanceof BoardError ? cause.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }

  return (
    <form className="board-form" onKeyDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submit() }}>
      <label>
        <span>{titleLabel} <small className={titleCount > titleMax ? 'over' : ''}>{titleCount}/{titleMax}</small></span>
        <input value={title} onChange={event => setTitle(event.target.value)} autoFocus={!initialTitle} />
        {titleHint && <small className="board-hint">{titleHint}</small>}
      </label>
      <label>
        <span>내용 <small className={contentCount > contentMax ? 'over' : ''}>{contentCount}/{contentMax}</small></span>
        <textarea rows={4} value={content} onChange={event => setContent(event.target.value)} autoFocus={!!initialTitle} />
      </label>
      {error && <p role="alert" className="board-error">{error}</p>}
      <div className="board-actions">
        <button type="button" className="research-close" onClick={onCancel}>취소</button>
        <button type="submit" className="research-close board-primary" disabled={!valid || busy}>{busy ? '저장 중…' : submitLabel}</button>
      </div>
    </form>
  )
}
