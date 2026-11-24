import { useEffect, useState } from 'react'
import { PagedList } from '../boards/BoardPagination'
import { BoardError } from '../boards/boardsApi'
import { LOGIN_URL, canWrite, useAuth } from '../auth/authStore'
import { playSfx } from '../../audio/AudioManager'
import { TIRED_MESSAGE, TIRED_STATUS, inventoryStore } from '../inventory/inventoryStore'
import { createIdea, fetchIdeas } from './officeApi'
import type { IdeaPost } from './officeApi'
import '../boards/boards.css'
import './office.css'

const date = (value: string) => new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * 아이디어 기획 게시판 본문: 게임 개발에 도움이 될 아이디어를 쓰고, 목록을 눌러 내용을 펼쳐 본다.
 * 내 자리 컴퓨터의 아이디어 아이콘 창에서 연다. 회원 글 하나에 HP -3·기력 -5, 동전 10원(하루 10번).
 *
 * @author 길태형
 * @version 1.0, 게시판 개편(내 자리 컴퓨터 아이콘)
 * @see None
 * @returns 게시판 본문
 */
export function IdeaBoard() {
  const auth = useAuth()
  const [ideas, setIdeas] = useState<IdeaPost[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchIdeas().then(setIdeas).catch(() => setMessage('게시판을 불러오지 못했어요.')) }, [])

  const submit = async () => {
    if (busy || !title.trim() || !content.trim()) return
    setBusy(true)
    try {
      const created = await createIdea(title, content)
      setIdeas(list => [created, ...(list ?? [])]); setTitle(''); setContent(''); setOpen(created.id)
      setMessage('아이디어를 올렸어요!'); playSfx('success', { volume: 0.6 }); void inventoryStore.refresh()
    } catch (cause) {
      playSfx('error', { volume: 0.5 })
      setMessage(cause instanceof BoardError && cause.status === TIRED_STATUS ? TIRED_MESSAGE : cause instanceof BoardError ? cause.message : '저장하지 못했어요.')
    } finally { setBusy(false) }
  }

  return (
    <div className="office-board">
      <p className="work-help">게임 개발에 도움이 될 아이디어를 적어 주세요. 새 방, 미니게임, NPC, 불편했던 점 무엇이든 좋아요.</p>
      {message && <p className="work-message" role="status">{message}</p>}
      {canWrite(auth) ? (
        <form className="work-form" onSubmit={event => { event.preventDefault(); void submit() }}>
          <label>제목<input maxLength={60} value={title} onChange={event => setTitle(event.target.value)} required /></label>
          <label>아이디어<textarea maxLength={1000} value={content} onChange={event => setContent(event.target.value)} required /></label>
          <button type="submit" className="board-primary" disabled={busy || !title.trim() || !content.trim()}>아이디어 올리기</button>
        </form>
      ) : <p className="board-login">글쓰기는 로그인 후 <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>}

      <h3 className="work-heading">올라온 아이디어 <span>{ideas?.length ?? 0}</span></h3>
      {!ideas && !message && <p role="status">불러오는 중…</p>}
      {ideas && ideas.length === 0 && <p className="work-empty">아직 아이디어가 없어요. 첫 아이디어를 올려 보세요!</p>}
      <PagedList items={ideas ?? []} label="아이디어 목록">{visible => <ul className="work-list">
        {visible.map(idea => (
          <li key={idea.id}>
            <button type="button" aria-expanded={open === idea.id} onClick={() => setOpen(open === idea.id ? null : idea.id)}>
              💡 {idea.title} <small>{idea.author ?? '익명'} · {date(idea.createdAt)}</small>
            </button>
            {open === idea.id && <p className="work-body">{idea.content}</p>}
          </li>
        ))}
      </ul>}</PagedList>
    </div>
  )
}
