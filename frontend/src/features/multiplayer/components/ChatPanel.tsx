import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatError } from '../model/protocol'
import './ChatPanel.css'

type Props = { roomName?: string; messages: ChatMessage[]; connected: boolean; error: ChatError | null;
  onSend: (message: string) => boolean; onInputFocus: (focused: boolean) => void; onExit: () => void; onEdit: () => void }
const errors: Record<ChatError, string> = { empty: '내용을 입력해 주세요.', too_long: '150자까지 보낼 수 있어요.',
  invalid: '보낼 수 없는 문자가 포함되어 있어요.', unavailable: '채팅 연결을 기다려 주세요.', rate_limited: '잠시 후 다시 보내 주세요.' }

/**
 * 기존 로비 소켓의 일반 텍스트 내역과 입력만 관리하는 접이식 채팅 패널이다.
 * @author seulgae
 * @version 1.0, 현재 방 채팅 표시와 기존 입력 잠금 유지
 * @see "None"
 * @param props 내역과 연결 상태, 전송 및 게임 입력 제어 콜백
 * @returns 오른쪽 하단 채팅 패널
 */
export default function ChatPanel({ roomName, messages, connected, error, onSend, onInputFocus, onExit, onEdit }: Props) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 560)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const composing = useRef(false)

  // 전역 Enter는 다른 입력창과 연구 패널을 가로채지 않는다. Scene/소켓 상태는 변경하지 않는다.
  useEffect(() => {
    let frame = 0
    const focus = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || document.querySelector('dialog[open]')) return
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],button')) return
      event.preventDefault(); event.stopPropagation()
      setCollapsed(false)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => input.current?.focus())
    }
    window.addEventListener('keydown', focus, true)
    return () => { window.removeEventListener('keydown', focus, true); cancelAnimationFrame(frame) }
  }, [])

  useLayoutEffect(() => {
    if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [messages, collapsed])

  /** IME 조합 완료 Enter는 전송으로 사용하지 않고, 실제 전송 성공 시에만 입력을 비운다. */
  const send = () => {
    if (composing.current) return
    if (!draft.trim()) { input.current?.blur(); onExit(); return }
    if (onSend(draft)) { setDraft(''); input.current?.blur(); onExit() }
  }
  const count = Array.from(draft).length
  return <aside className={`chat-panel${collapsed ? ' is-collapsed' : ''}`} aria-label="로비 채팅" onKeyDown={event => event.stopPropagation()}>
    <header className="chat-panel-header"><span>{roomName ?? "LOBBY"} CHAT <small>{connected ? '연결됨' : '연결 대기'}</small></span>
      <button type="button" aria-expanded={!collapsed} aria-controls="lobby-chat-body" onClick={() => setCollapsed(value => !value)}>{collapsed ? '펼치기' : '접기'}</button></header>
    {!collapsed && <div id="lobby-chat-body">
      <div ref={list} className="chat-messages" role="log" aria-label="최근 채팅 내역" aria-live="polite" onScroll={() => {
        const element = list.current
        if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 28
      }}>
        {messages.length === 0 && <p className="chat-empty">Enter를 눌러 이야기를 시작해 보세요.</p>}
        {messages.map(message => <div className="chat-message" key={message.messageId}>
          <div><strong>{message.nickname}</strong><time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div>
          <p>{message.message}</p>
        </div>)}
      </div>
      <form className="chat-form" onSubmit={event => { event.preventDefault(); send() }}>
        <label className="chat-input-label" htmlFor="lobby-chat-input">메시지 <small>{count}/150</small></label>
        <div className="chat-compose"><textarea ref={input} id="lobby-chat-input" rows={2} maxLength={300} disabled={!connected}
          placeholder={connected ? 'Enter로 대화 · ESC로 돌아가기' : '로비에 연결되면 채팅할 수 있어요'}
          value={draft} onChange={event => { setDraft(event.target.value); onEdit() }} onFocus={() => onInputFocus(true)} onBlur={() => onInputFocus(false)}
          onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return
            if (event.key === 'Escape') { event.preventDefault(); setDraft(''); input.current?.blur(); onExit() }
            else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
          }} />
          <button type="submit" disabled={!connected || !draft.trim() || count > 150}>전송</button></div>
        <p className="chat-help" role="status">{error ? errors[error] : count > 150 ? errors.too_long : '최근 50개 · Shift+Enter 줄바꿈'}</p>
      </form>
    </div>}
  </aside>
}
