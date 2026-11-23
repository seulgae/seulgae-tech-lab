import { useEffect, useRef } from 'react'
import { SERVER_BLOG_URL } from '../../../game/npc/npcData'
import '../../../components/panel.css'
import './LabInfoPanel.css'

/**
 * 서버실 관리 로봇에게 말을 걸면 여는 창: 서버 용량 조사를 어떻게 만들었는지 요약하고 블로그 글로 보낸다.
 *
 * @author seulgae
 * @version 1.0, 서버실 관리 로봇
 * @see "docs/server-capacity.md"
 * @param props 닫기 콜백
 * @returns 블로그 안내 모달
 */
export default function ServerBlogPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return (
    <dialog ref={dialogRef} className="research-panel lab-panel" aria-labelledby="server-blog-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SERVER ROOM / ROBOT</p>
          <h2 id="server-blog-title">삐빅, 서버 점검은 이렇게 해요</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose}>닫기</button>
      </header>
      <p className="rack-note">랙에 보이는 CPU·메모리·가동시간은 백엔드가 SSH로 호스트에 직접 물어봐서 모아요.</p>
      <ul className="server-blog-points">
        <li><strong>Apache MINA SSHD</strong>로 접속해요. JSch는 서버의 최신 암호화 정책과 맞지 않아 접속에 실패했었어요.</li>
        <li>셸 대신 <code>EXEC</code> 채널로 명령 하나만 보내고, 연결·인증·실행 단계마다 10초 제한을 둬요.</li>
        <li>30초마다 <code>vmstat</code>·<code>free</code>·<code>/proc/uptime</code>을 읽어 1~4번 랙에 나눠 보여 줘요.</li>
        <li>키 로그인과 known_hosts 검증, 그리고 이 키로는 측정 스크립트 하나만 돌게 묶어 뒀어요.</li>
      </ul>
      <a className="server-blog-link" href={SERVER_BLOG_URL} target="_blank" rel="noopener noreferrer" autoFocus>
        블로그 글 읽기 · JSch에서 MINA SSHD로 ↗
      </a>
      <p className="research-footer">새 탭에서 열려요 · ESC로 닫기</p>
    </dialog>
  )
}
