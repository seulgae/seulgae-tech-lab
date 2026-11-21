import { useEffect, useState } from 'react'
import { LEVEL_NAMES, decideLevel, fetchPendingLevels } from './levelApi'
import type { LevelRequest } from './levelApi'
import { playSfx } from '../../audio/AudioManager'

/**
 * 관리자실 쿼리 콘솔 위쪽: 검토 중인 등급 신청을 승인·반려한다(승인하면 회원 등급이 오른다).
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 * @returns 등급 신청 목록
 */
export default function LevelRequestsBox() {
  const [requests, setRequests] = useState<LevelRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchPendingLevels().then(setRequests).catch(cause => setError(cause instanceof Error ? cause.message : '불러오지 못했어요.')) }, [])

  const decide = async (id: string, approve: boolean) => {
    try {
      await decideLevel(id, approve)
      setRequests(list => (list ?? []).filter(request => request.id !== id))
      playSfx(approve ? 'success' : 'click', { volume: 0.5 })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '처리하지 못했어요.') }
  }

  return (
    <section className="level-requests" aria-label="등급 신청">
      <h3>등급 신청 <span>{requests?.length ?? 0}</span></h3>
      {error && <p className="sql-error">{error}</p>}
      {requests && requests.length === 0 && <p className="sql-help">검토 중인 신청이 없어요.</p>}
      <ul>
        {requests?.map(request => (
          <li key={request.id}>
            <strong>{request.nickname}</strong> → {LEVEL_NAMES[request.requestedLevel]}
            <small>{request.reason}</small>
            <span>
              <button type="button" onClick={() => void decide(request.id, false)}>반려</button>
              <button type="button" className="board-primary" onClick={() => void decide(request.id, true)}>승인</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
