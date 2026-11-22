import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/authStore'
import { AGENTS, STATE, REVIEW_STATE, request, safeLink } from './recruitmentApi'
import type { Dashboard, Posting } from './recruitmentApi'
import '../research/components/ResearchPanel.css'
import './recruitment.css'

const when = (value?: string | Date) => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미실행'
const fields: Record<string, string> = { javaBackend: 'Java 백엔드', companyType: '기업 유형', employees: '직원 수', rating: '잡플래닛 평점', probationMonths: '수습 개월', accepting: '접수 중', deadline: '마감일' }

/**
 * 실제 채용 업무 이력·공고 근거와 관리자 수동 실행·보완 입력을 제공한다.
 * @author seulgae
 * @version 1.0, 서비스 연구실 채용 대시보드
 * @see "None"
 * @returns 채용 업무 모달
 */
export default function RecruitmentPanel({ agent, onClose }: { agent: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Posting | null>(null)
  const [evidence, setEvidence] = useState('')
  const [imports, setImports] = useState('')
  const [reviewFilter, setReviewFilter] = useState('NEW')
  const [filter, setFilter] = useState('ALL')
  const auth = useAuth()
  const current = AGENTS.find(a => a.id === agent) ?? AGENTS[0]
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close() }, [])
  useEffect(() => {
    if (!auth.admin) return
    const controller = new AbortController()
    const load = () => { request<Dashboard>('', 'GET', undefined, controller.signal).then(value => { setData(value); setError('') }).catch(e => { if (!controller.signal.aborted) setError(String(e.message)) }) }
    load(); const timer = setInterval(load, 10000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [auth.admin])
  /** 중복 조작을 막고 서버에서도 권한과 선행 업무를 재검증한다. */
  const run = async (task: string, date?: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { setData(await request<Dashboard>(`/jobs/${task}${date ? `?date=${date}` : ""}`, 'POST')) } catch (e) { setError(e instanceof Error ? e.message : '실행 실패') } finally { setBusy(false) }
  }
  /** 근거 입력을 사용자용 필드에 연결하고 확인 시각을 함께 기록한다. */
  const editFact = (field: string, part: string, value: unknown) => {
    const facts = JSON.parse(evidence || '{}')
    facts[field] = { value: null, url: '', quote: '', ...facts[field], [part]: value, checkedAt: new Date().toISOString() }
    setEvidence(JSON.stringify(facts))
  }
  /** 관리자가 직접 확인한 사실만 명시적으로 저장한다. */
  const save = async () => {
    if (!selected || busy) return
    setBusy(true)
    try { setData(await request<Dashboard>(`/collections/${selected.id}/evidence`, 'PUT', Object.fromEntries(Object.entries(JSON.parse(evidence)).filter(([, f]) => (f as { value: unknown }).value != null)))); setSelected(null); setError('') } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') } finally { setBusy(false) }
  }
  /** 사용자가 실제로 확인하거나 지원한 상태만 기록한다. 외부 지원서는 제출하지 않는다. */
  const changeReview = async (id: string, state: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { setData(await request<Dashboard>(`/reviews/${id}`, 'PATCH', { state })) } catch (e) { setError(e instanceof Error ? e.message : '변경 실패') } finally { setBusy(false) }
  }
  /** 채팅에서 받은 정형 공고를 서버의 한도·중복 검사를 거쳐 접수한다. */
  const importBatch = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { const result = await request<{ registered: number; remaining: number }>('/imports', 'POST', JSON.parse(imports)); setImports(''); setData(await request<Dashboard>()); setError(`${result.registered}건 접수 · 오늘 추가 가능 ${result.remaining}건`) } catch (e) { setError(e instanceof Error ? e.message : '접수 실패') } finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="research-panel recruitment-panel" aria-labelledby="recruitment-title" onCancel={e => { e.preventDefault(); onClose() }}>
    <header className="research-panel-header"><div><p className="research-eyebrow">SERVICE LAB / RECRUITMENT</p><h2 id="recruitment-title">{current.name} · {current.role}</h2><p>매분 수신 공고 처리·마감일 확인 · 한국 시간 기준 하루 최대 10건</p></div><button onClick={onClose}>닫기</button></header>
    {error && <p role="alert">{error}</p>}
    {!auth.admin ? <p>공고와 상세 업무 기록은 관리자 로그인 후 확인할 수 있어요.</p> : <>
      <p>채팅에서 분석·정형화한 공고를 접수합니다. 검색 API 토큰은 필요하지 않습니다. 마감된 공고는 삭제하고 지원·보류 기록은 별도로 보존합니다.</p>
      <details><summary>정형 공고 접수 · 하루 최대 10개 기업</summary><p>채팅에서 받은 공고 배열을 붙여 넣으세요. 미확인 사실은 생략하고 원본 링크와 근거를 포함해야 합니다.</p><textarea aria-label="정형 공고 배열" rows={6} value={imports} onChange={e => setImports(e.target.value)} /><button disabled={busy || !imports.trim()} onClick={() => { void importBatch() }}>공고 접수</button></details>
      <section className="recruitment-actions" aria-label="수동 업무 실행">{['SEARCH', 'CHECK', 'REGISTER', 'REPORT'].map((task, i) => <button key={task} disabled={busy} onClick={() => { void run(task) }}>{['서치 · 접수 확인', '체크 · 정제', '로그 · 반영', '로그 · 마감 정리·보고'][i]}</button>)}</section>
      {busy && <p role="status">접수한 공고와 업무 상태를 처리하고 있어요.</p>}
      {data && <>
        <dl className="recruitment-stats">{Object.entries({ collected: '누적 수집', active: '활성 추천', eligible: '조건 충족', review: '검토 필요', new_today: '금일 신규', expired_today: '금일 마감' }).map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{data.stats[key] ?? 0}</dd></div>)}</dl>
        <h3>업무 이력</h3><ul>{data.jobs.slice(0, 12).map(j => <li key={`${j.work_date}-${j.task}`}>{j.work_date} {j.task} · {STATE[j.state]} · {j.processed}건 · 시도 {j.attempts}회<br /><small>시작 {when(j.started_at)} / 종료 {when(j.finished_at)} {j.error && `· ${j.error}`}</small>{["FAILED", "UNAVAILABLE", "WORKING"].includes(j.state) && <button disabled={busy} onClick={() => { void run(j.task, j.work_date) }}>이 업무 재시도</button>}</li>)}</ul>
        <h3>검토·지원 관리</h3><label>분류 <select value={reviewFilter} onChange={e => setReviewFilter(e.target.value)}><option value="ALL">전체</option>{Object.entries(REVIEW_STATE).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        {data.reviews.filter(r => reviewFilter === 'ALL' || r.state === reviewFilter).map(r => <article className="recruitment-posting" key={r.id}><h4>{r.company} · {r.title}</h4><p>{REVIEW_STATE[r.state]} · {when(r.updated_at)}{r.collection_id == null && ' · 원본 공고 마감 삭제됨'}</p><p>{r.snapshot.stack ?? '기술 미확인'} · {r.snapshot.career ?? '경력 미확인'}</p>
          {r.collection_id != null && safeLink(r.snapshot.url) && <a href={r.snapshot.url} target="_blank" rel="noopener noreferrer">공고 읽기</a>}
          {r.collection_id != null && <>{r.state === 'NEW' && <button disabled={busy} onClick={() => { void changeReview(r.id, 'READ') }}>읽음 처리</button>}{r.state === 'READ' && <button disabled={busy} onClick={() => { void changeReview(r.id, 'CONFIRMED') }}>내용 확인 완료</button>}{['CONFIRMED', 'HOLD'].includes(r.state) && <button disabled={busy} onClick={() => { void changeReview(r.id, 'APPLIED') }}>지원 완료로 기록</button>}{r.state === 'CONFIRMED' && <button disabled={busy} onClick={() => { void changeReview(r.id, 'HOLD') }}>지원 보류</button>}</>}
          <small>지원 완료는 직접 지원한 사실을 기록하며 지원서를 자동 제출하지 않습니다.</small>
        </article>)}
        <h3>공고</h3><label>표시 범위 <select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">전체 후보</option><option value="ELIGIBLE">확정 추천 · 활성</option><option value="REVIEW">검토 필요</option><option value="REJECTED">제외</option><option value="EXPIRED">마감 이력</option></select></label>
        {data.postings.filter(p => filter === 'ALL' || (filter === 'EXPIRED' ? p.status === 'EXPIRED' : p.validation === filter && (filter !== 'ELIGIBLE' || p.status === 'ACTIVE'))).map(p => <article key={p.id} className="recruitment-posting"><h4>{p.details.company} · {p.details.title}</h4><p>{p.validation} / {p.status ?? '등록 전'}</p><p>{p.details.stack ?? '기술 미확인'} · {p.details.career ?? '경력 미확인'} · {p.details.region ?? '지역 미확인'}</p>
          <dl>{Object.entries(fields).map(([key, title]) => { const f = p.details.facts?.[key]; return <div key={key}><dt>{title}</dt><dd>{f?.value == null ? '미확인' : String(f.value)} {f && safeLink(f.url) && <><a href={f.url} target="_blank" rel="noopener noreferrer">근거</a> <small>{when(f.checkedAt)}</small><q>{f.quote}</q></>}</dd></div> })}</dl>
          {p.details.snippet && <p>검색 발췌 · {p.details.snippet}</p>}
          {p.details.companyClues?.map(clue => safeLink(clue.url) && <p key={clue.url}><a href={clue.url} target="_blank" rel="noopener noreferrer">기업정보 확인 단서</a> · {clue.text}</p>)}
          <p>{p.reasons.join(' · ')}</p>{safeLink(p.details.url) && <a href={p.details.url} target="_blank" rel="noopener noreferrer">원본 공고</a>} <button disabled={busy} onClick={() => { setSelected(p); setEvidence(JSON.stringify(p.details.facts ?? {}, null, 2)) }}>확인한 근거 보완</button>
        </article>)}
        {data.postings.length === 0 && <p>접수된 공고가 없습니다. 채팅에서 분석한 정형 공고를 등록하세요.</p>}
        {selected && <section><h3>{selected.details.company} · 수동 근거 보완</h3><p>원문을 확인한 항목만 값·출처 주소·근거 문구를 입력하세요. 평점은 잡플래닛 출처만 허용합니다.</p>
          {Object.entries(fields).map(([field, title]) => {
            const f = JSON.parse(evidence || '{}')[field] ?? { value: null, url: '', quote: '' }
            return <fieldset key={field}><legend>{title}</legend>
              {['javaBackend', 'accepting', 'companyType'].includes(field) ? <select aria-label={`${title} 값`} value={f.value == null ? '' : String(f.value)} onChange={e => editFact(field, 'value', e.target.value === '' ? null : field === 'companyType' ? e.target.value : e.target.value === 'true')}>
                <option value="">미확인</option>{field === 'companyType' ? <><option value="SME">중소기업</option><option value="MID">중견기업</option><option value="LARGE">대기업</option><option value="OTHER">기타</option></> : <><option value="true">예</option><option value="false">아니요</option></>}
              </select> : <input aria-label={`${title} 값`} type={field === 'deadline' ? 'date' : 'number'} step={field === 'rating' ? '0.1' : '1'} value={f.value ?? ''} onChange={e => editFact(field, 'value', !e.target.value ? null : field === 'deadline' ? e.target.value : Number(e.target.value))} />}
              <label>출처 주소<input type="url" value={f.url} onChange={e => editFact(field, 'url', e.target.value)} /></label>
              <label>확인한 원문<textarea rows={2} maxLength={1000} value={f.quote} onChange={e => editFact(field, 'quote', e.target.value)} /></label>
            </fieldset>
          })}<button disabled={busy} onClick={() => { void save() }}>근거 저장·재검증</button><button onClick={() => setSelected(null)}>취소</button></section>}
        <h3>일일 보고서</h3>{data.reports.map(r => <p key={r.work_date}>{r.work_date} · 수집 {r.summary.collected} / 활성 추천 {r.summary.active} / 신규 {r.summary.new_today} / 마감 {r.summary.expired_today}</p>)}
      </>}
    </>}
  </dialog>
}
