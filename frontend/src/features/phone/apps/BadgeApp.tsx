import { useEffect, useState } from 'react'
import { RANK_COLORS, fetchBadge, promotionProgress, remainText } from '../../badge/badgeApi'
import type { BadgeView } from '../../badge/badgeApi'

/**
 * 폰 사원증 앱: 직급 배지, 승진까지 진행률, 10분 급여와 다음 급여까지 남은 시간, 오늘 받은 급여, 직급표.
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see None
 * @returns 사원증 화면
 */
export default function BadgeApp() {
  const [view, setView] = useState<BadgeView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => { fetchBadge().then(next => { setView(next); setLeft(next.nextSalarySeconds) }).catch(cause => setError(cause instanceof Error ? cause.message : '불러오지 못했어요.')) }, [])
  /* 다음 급여까지 남은 시간은 1초마다 줄인다(지급은 화면이 1분마다 서버에 확인한다). */
  useEffect(() => { const timer = window.setInterval(() => setLeft(value => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer) }, [])

  if (error) return <div className="phone-app-body"><p className="phone-error" role="alert">{error}</p></div>
  if (!view) return <div className="phone-app-body"><p className="phone-note">사원증을 불러오는 중…</p></div>
  const color = RANK_COLORS[view.rank.code] ?? '#9ca3af'
  const progress = promotionProgress(view)

  return (
    <div className="phone-app-body">
      {/* 사원증 카드 */}
      <section className="badge-card" style={{ ['--rank' as string]: color }} aria-label="사원증">
        <div className="badge-strap" aria-hidden="true" />
        <p className="badge-org">SEULGAE TECH LAB</p>
        <div className="badge-photo" aria-hidden="true">🧑‍🔬</div>
        <strong className="badge-name">{view.nickname}</strong>
        <span className="badge-rank">{view.rank.name}</span>
        <small>누적 일 완료 {view.workCount}회</small>
      </section>

      <section className="phone-card" aria-label="승진">
        <h3>승진</h3>
        {view.next ? (
          <>
            <p className="badge-progress-text">{view.next.name}까지 {view.workCount}/{view.next.minWork}</p>
            <span className="inventory-bar badge-progress" role="meter" aria-label="승진 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
            <small className="phone-muted">내 자리 컴퓨터 메일의 오늘 업무를 다 하면 1회 완료(하루 한 번)</small>
          </>
        ) : <p className="phone-note">최고 직급이에요. HP·기력이 무제한!</p>}
      </section>

      <section className="phone-card" aria-label="급여">
        <h3>급여</h3>
        <p className="badge-pay">10분마다 <strong>🪙 {view.rank.pay}원</strong></p>
        <small className="phone-muted">다음 급여까지 {remainText(left)} · 오늘 {view.salaryCountToday}번, 약 {view.salaryToday.toLocaleString('ko-KR')}원</small>
        <small className="phone-muted">접속해 있으면 저절로 들어와요.</small>
      </section>

      <section className="phone-card" aria-label="직급표">
        <h3>직급표</h3>
        <table className="badge-table">
          <thead><tr><th>직급</th><th>완료</th><th>급여</th><th>HP·기력</th></tr></thead>
          <tbody>
            {view.ranks.map(rank => (
              <tr key={rank.code} className={rank.code === view.rank.code ? 'current' : ''}>
                <td><span className="badge-dot" style={{ background: RANK_COLORS[rank.code] }} />{rank.name}</td>
                <td>{rank.minWork}</td><td>{rank.pay}원</td><td>{rank.unlimited ? '∞' : rank.vitalsMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
