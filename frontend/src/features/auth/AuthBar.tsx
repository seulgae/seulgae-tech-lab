import { useEffect, useRef, useState } from 'react'
import { LOGIN_URL, NICKNAME_PATTERN, authStore, useAuth } from './authStore'
import './auth.css'

/**
 * 헤더의 로그인 영역. 카카오 키가 설정돼 있을 때만 보이며, 로그인하면 닉네임·닉네임 변경·로그아웃을 보여 준다.
 * 처음 로그인(회원가입)으로 돌아오면(?welcome=1) 닉네임 확인 창을 연다.
 *
 * @author seulgae
 * @version 1.0, 카카오 로그인 헤더
 * @see "None"
 */
export default function AuthBar() {
  const auth = useAuth()
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('welcome') === '1') setEditing(true)
    if (params.get('login') === 'failed') setNotice('카카오 로그인에 실패했어요. 다시 시도해 주세요.')
    if (params.has('welcome') || params.has('login')) {
      params.delete('welcome'); params.delete('login')
      const query = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
    }
  }, [])

  if (!auth.loaded || !auth.kakaoEnabled) return null
  return (
    <div className="auth-bar">
      {notice && <span className="auth-notice" role="alert">{notice}</span>}
      {auth.member ? <>
        <span className="auth-name">{auth.member.nickname} 님</span>
        <button type="button" onClick={() => setEditing(true)}>닉네임</button>
        <button type="button" onClick={() => { void authStore.logout().then(() => window.location.reload()) }}>로그아웃</button>
      </> : <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a>}
      {editing && auth.member && <NicknameDialog initial={auth.member.nickname} onClose={() => setEditing(false)} />}
    </div>
  )
}

/** 회원가입 직후·닉네임 변경 때 여는 닉네임 확인 창. 로비 이름표와 같은 규칙(1~16자)이다. */
function NicknameDialog({ initial, onClose }: { initial: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { const d = dialog.current; d?.showModal(); return () => d?.close() }, [])
  const valid = NICKNAME_PATTERN.test(value.trim())
  const save = async () => {
    if (!valid || busy) return
    setBusy(true); setError(null)
    try {
      const member = await authStore.rename(value.trim())
      try { sessionStorage.setItem('lab.nickname', member.nickname) } catch { /* 다음 접속부터 적용 */ }
      onClose()
      window.location.reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요.') }
    finally { setBusy(false) }
  }
  return (
    <dialog ref={dialog} className="research-panel auth-dialog" aria-labelledby="nickname-title" onCancel={event => { event.preventDefault(); onClose() }}
      onKeyDown={event => event.stopPropagation()}>
      <h2 id="nickname-title">연구원 닉네임</h2>
      <p>연구소에서 이름표로 보일 닉네임이에요. 1~16자의 글자·숫자·_·-를 쓸 수 있어요.</p>
      <form onSubmit={event => { event.preventDefault(); void save() }}>
        <input value={value} onChange={event => setValue(event.target.value)} autoFocus maxLength={32} aria-label="닉네임" />
        {error && <p role="alert" className="board-error">{error}</p>}
        <div className="board-actions">
          <button type="button" className="research-close" onClick={onClose}>나중에</button>
          <button type="submit" className="research-close board-primary" disabled={!valid || busy}>{busy ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </dialog>
  )
}
