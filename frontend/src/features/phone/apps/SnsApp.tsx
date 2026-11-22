import { useEffect, useState } from 'react'
import { playSfx } from '../../../audio/AudioManager'
import { SNS_CONTENT_MAX, deleteSns, fetchSns, writeSns } from '../phoneApi'
import type { SnsPost } from '../phoneApi'

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '요청에 실패했어요.'

/** "방금", "5분 전", "3시간 전", 그보다 오래면 날짜 */
export function agoText(createdAt: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`
  return new Date(createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

/**
 * 폰 SNS 앱: 연구원들이 올린 짧은 글(140자)을 최근순으로 보고, 글을 올리거나 내 글을 지운다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(SNS)
 * @see "None"
 * @param props canWrite: 로그인 회원이면 글쓰기 칸을 보여 준다
 * @returns SNS 화면
 */
export default function SnsApp({ canWrite }: { canWrite: boolean }) {
  const [posts, setPosts] = useState<SnsPost[] | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchSns().then(setPosts).catch(cause => setError(errorText(cause))) }, [])

  const write = async () => {
    if (!content.trim() || busy) return
    setBusy(true)
    try {
      const post = await writeSns(content)
      setPosts(list => [post, ...(list ?? [])])
      setContent(''); setError(null)
      playSfx('chat', { volume: 0.5 })
    } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }

  const remove = async (post: SnsPost) => {
    if (!window.confirm('이 글을 지울까요?')) return
    try { await deleteSns(post.id); setPosts(list => (list ?? []).filter(item => item.id !== post.id)) } catch (cause) { setError(errorText(cause)) }
  }

  const left = SNS_CONTENT_MAX - [...content].length

  return (
    <div className="phone-app-body">
      {canWrite && (
        <form className="sns-compose" onSubmit={event => { event.preventDefault(); void write() }}>
          <textarea aria-label="새 글" placeholder="연구소에 무슨 일이 있었나요?" rows={3} maxLength={SNS_CONTENT_MAX} value={content}
            onChange={event => setContent(event.target.value)} onKeyDown={event => event.stopPropagation()} />
          <div><small className={left < 10 ? 'warn' : ''}>{left}자 남음</small><button type="submit" className="phone-primary" disabled={!content.trim() || busy}>올리기</button></div>
        </form>
      )}
      {error && <p className="phone-error" role="alert">{error}</p>}
      {posts && posts.length === 0 && <p className="phone-muted">아직 글이 없어요. 첫 글을 남겨 봐요!</p>}
      <ul className="sns-feed">
        {posts?.map(post => (
          <li key={post.id} className={post.mine ? 'mine' : ''}>
            <header><strong>{post.nickname}</strong><small>{agoText(post.createdAt)}</small>
              {post.mine && <button type="button" aria-label="내 글 지우기" onClick={() => void remove(post)}>지우기</button>}</header>
            <p>{post.content}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
