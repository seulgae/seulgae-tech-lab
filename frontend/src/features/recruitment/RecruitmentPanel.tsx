import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/authStore'
import { PagedList } from '../boards/BoardPagination'
import { AGENTS, STATE, REVIEW_STATE, request, safeLink } from './recruitmentApi'
import type { Dashboard, Fact, Job, Posting, Review } from './recruitmentApi'
import '../../components/panel.css'
import './recruitment.css'

const when = (value?: string | Date) => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '기록 없음'
const fields: Record<string, string> = { javaBackend: 'Java 백엔드', companyType: '기업 유형', employees: '직원 수', rating: '잡플래닛 평점', probationMonths: '수습 기간', accepting: '접수 여부', deadline: '마감일' }
const validations: Record<string, string> = { ELIGIBLE: '조건 충족', REVIEW: '검토 필요', REJECTED: '조건 제외' }
const desks = {
  SEARCH: { title: '새 공고 접수함', help: '들어온 공고와 중복 여부를 살펴봐요.', step: '01', tasks: ['SEARCH'], action: '접수 현황 확인' },
  CHECK: { title: '공고 검토실', help: '조건과 출처를 확인하고 빠진 근거를 채워요.', step: '02', tasks: ['CHECK'], action: '조건 다시 검토' },
  REGISTER: { title: '지원 관리실', help: '읽고 확인한 공고를 지원 또는 보류로 정리해요.', step: '03', tasks: ['REGISTER', 'REPORT'], action: '검토 결과 반영' },
} as const

/**
 * 서치·체크·로그의 역할에 맞는 접수함, 근거 검토, 지원 관리 화면을 제공한다.
 * @author seulgae
 * @version 1.2, 역할별 업무 공간과 5건 목록·선택 상세
 * @see "None"
 * @param props 담당 직원과 닫기 콜백
 * @returns 채용 업무 모달
 */
export default function RecruitmentPanel({ agent, onClose }: { agent: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [evidence, setEvidence] = useState<Record<string, Fact>>({})
  const [imports, setImports] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [retry, setRetry] = useState(0)
  const auth = useAuth()
  const current = AGENTS.find(a => a.id === agent) ?? AGENTS[0]
  const desk = desks[current.id]
  const isLog = current.id === 'REGISTER', isCheck = current.id === 'CHECK'
  const selectedPosting = data?.postings.find(p => p.id === selectedId)
  const selectedReview = data?.reviews.find(r => r.id === selectedId)
  const details = isLog ? selectedReview?.snapshot : selectedPosting?.details
  const selected = isLog ? selectedReview : selectedPosting
  const jobs = data?.jobs.filter(j => (desk.tasks as readonly string[]).includes(j.task)) ?? []

  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close() }, [])
  useEffect(() => {
    if (!auth.admin) return
    const controller = new AbortController()
    const load = async () => {
      try { const value = await request<Dashboard>('', 'GET', undefined, controller.signal); if (!controller.signal.aborted) { setData(value); setError('') } }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '공고를 불러오지 못했어요.') }
    }
    void load(); const timer = setInterval(() => { void load() }, 10000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [auth.admin, retry])

  /** 선택을 해제해 모바일 목록과 상세를 오갈 수 있게 한다. */
  const clearSelection = () => { setSelectedId(null); setEditing(false) }
  /** 목록에서 고른 공고만 상세에 표시하며 읽음 상태는 임의로 바꾸지 않는다. */
  const select = (id: string) => { setSelectedId(id); setEditing(false); setError(''); setNotice('') }
  /** 현재 담당자에게 속한 업무만 수동 실행한다. */
  const run = async (task: string, date?: string) => {
    if (busy || !(desk.tasks as readonly string[]).includes(task)) return
    setBusy(true); setError(''); setNotice('')
    try { setData(await request<Dashboard>(`/jobs/${task}${date ? `?date=${date}` : ''}`, 'POST')); setNotice('업무 결과를 갱신했어요.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '실행하지 못했어요.') }
    finally { setBusy(false) }
  }
  /** 검토자가 확인한 값과 원문을 입력할 때만 확인 시각을 갱신한다. */
  const editFact = (field: string, part: string, value: unknown) => {
    setEvidence(facts => ({ ...facts, [field]: { ...(facts[field] ?? { value: null, url: '', quote: '' }), [part]: value, checkedAt: new Date().toISOString() } }))
  }
  /** 체크 담당 화면에서 확인한 근거를 저장하고 서버에서 재검증한다. */
  const save = async () => {
    if (!selectedPosting || busy || !isCheck) return
    setBusy(true); setError('')
    try { setData(await request<Dashboard>(`/collections/${selectedPosting.id}/evidence`, 'PUT', Object.fromEntries(Object.entries(evidence).filter(([, fact]) => fact.value != null)))); setEditing(false); setNotice('근거를 저장하고 검토 결과를 갱신했어요.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요.') }
    finally { setBusy(false) }
  }
  /** 로그 담당 화면에서 사용자가 직접 고른 읽음·확인·지원·보류 상태만 저장한다. */
  const changeReview = async (id: string, state: string) => {
    if (busy || !isLog) return
    setBusy(true); setError('')
    try { setData(await request<Dashboard>(`/reviews/${id}`, 'PATCH', { state })); setNotice(`${REVIEW_STATE[state]} 상태로 기록했어요.`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '변경하지 못했어요.') }
    finally { setBusy(false) }
  }
  /** 서치 담당 화면에서 분석된 공고를 한도·중복 검사를 거쳐 접수한다. */
  const importBatch = async () => {
    if (busy || current.id !== 'SEARCH') return
    setBusy(true); setError(''); setNotice('')
    try { const result = await request<{ registered: number; remaining: number }>('/imports', 'POST', JSON.parse(imports)); setImports(''); setData(await request<Dashboard>()); clearSelection(); setNotice(`${result.registered}건 접수 · 오늘 추가 가능 ${result.remaining}건`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '공고를 접수하지 못했어요.') }
    finally { setBusy(false) }
  }
  const postings = data?.postings.filter(p => filter === 'ALL' || p.validation === filter) ?? []
  const reviews = data?.reviews.filter(r => filter === 'ALL' || r.state === filter) ?? []
  const options = isLog ? REVIEW_STATE : validations
  const stats = isLog
    ? [['지원 완료', data?.reviews.filter(r => r.state === 'APPLIED').length ?? 0], ['보류 중', data?.reviews.filter(r => r.state === 'HOLD').length ?? 0], ['확인 대기', data?.reviews.filter(r => ['NEW', 'READ'].includes(r.state)).length ?? 0]]
    : isCheck ? [['검토 필요', data?.stats.review ?? 0], ['조건 충족', data?.stats.eligible ?? 0], ['전체 공고', data?.postings.length ?? 0]]
      : [['접수 공고', data?.stats.collected ?? 0], ['오늘 반영', data?.stats.new_today ?? 0], ['하루 접수 한도', 10]]

  return <dialog ref={dialog} className="research-panel recruitment-panel" data-desk={current.id} aria-labelledby="recruitment-title"
    onCancel={event => { event.preventDefault(); if (editing) setEditing(false); else if (selectedId) clearSelection(); else onClose() }}>
    <header className="recruitment-header">
      <div className="recruitment-avatar" aria-hidden="true">{desk.step}</div>
      <div><p className="research-eyebrow">{current.name}의 업무 공간</p><h2 id="recruitment-title">{desk.title}</h2><p>{desk.help}</p></div>
      <button type="button" className="research-close" onClick={onClose}>닫기</button>
    </header>
    <ol className="recruitment-steps" aria-label="채용 업무 분담">{AGENTS.map(a => <li key={a.id} aria-current={current.id === a.id ? 'step' : undefined}><span>{desks[a.id].step}</span> {a.name} · {a.id === 'SEARCH' ? '접수' : a.id === 'CHECK' ? '검토' : '지원 관리'}</li>)}</ol>
    <div className="recruitment-body">
      {!auth.admin ? <div className="recruitment-empty">관리자 로그인 후 담당 공고를 확인할 수 있어요.</div> : <>
        <dl className="recruitment-stats">{stats.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}<small>건</small></dd></div>)}</dl>
        <div className="recruitment-feedback" aria-live="polite">{notice && <p className="recruitment-notice" role="status">{notice}</p>}{error && <p className="recruitment-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></p>}{busy && <p role="status">처리하고 있어요…</p>}</div>
        {!data ? !error && <p role="status">담당 공고를 불러오는 중…</p> : <>
          <div className="recruitment-toolbar"><h3>{isLog ? '지원할 공고와 내역' : isCheck ? '검토할 공고' : '접수된 공고'}</h3>
            {current.id !== 'SEARCH' && <label>분류 <select aria-label="공고 분류" value={filter} onChange={e => { setFilter(e.target.value); clearSelection() }}><option value="ALL">전체</option>{Object.entries(options).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>}
            <button type="button" disabled={busy} onClick={() => { void run(desk.tasks[0]) }}>{desk.action}</button>
          </div>
          <div className={`recruitment-workspace${selected && details ? ' has-selection' : ''}`}>
            <section className="recruitment-list" aria-label={desk.title}>
              <p className="recruitment-list-caption">{isLog ? reviews.length : postings.length}건 · 한 페이지에 5건</p>
              {isLog ? <PagedList key={`reviews-${filter}`} items={reviews} label="지원 관리">{visible => <ul>{visible.map(r => <li key={r.id}><PostingCard details={r.snapshot} selected={selectedId === r.id} badge={REVIEW_STATE[r.state] ?? '상태 확인 필요'} onSelect={() => select(r.id)} /></li>)}</ul>}</PagedList>
                : <PagedList key={`postings-${filter}`} items={postings} label="채용 공고">{visible => <ul>{visible.map(p => <li key={p.id}><PostingCard details={p.details} selected={selectedId === p.id} badge={validations[p.validation] ?? '검토 대기'} onSelect={() => select(p.id)} /></li>)}</ul>}</PagedList>}
              {(isLog ? reviews.length : postings.length) === 0 && <p className="recruitment-empty">이 분류에 해당하는 공고가 없어요.</p>}
            </section>
            <section className="recruitment-detail" aria-label="선택한 공고 상세">
              {!selected || !details ? <div className="recruitment-empty"><span aria-hidden="true">↗</span><h3>공고를 선택해 주세요</h3><p>{isCheck ? '조건과 확인 근거를 나란히 살펴볼 수 있어요.' : isLog ? '내용을 읽고 다음 단계를 직접 선택할 수 있어요.' : '기업과 모집 내용을 확인할 수 있어요.'}</p></div> : <>
                <button type="button" className="recruitment-back" onClick={clearSelection}>← 목록으로</button>
                <p className="recruitment-company">{details.company}</p><h3>{details.title}</h3>
                <div className="recruitment-meta"><span>{details.region ?? '지역 미확인'}</span><span>{details.career ?? '경력 미확인'}</span><span>{details.stack ?? '기술 미확인'}</span></div>
                {details.summary && <p className="recruitment-summary">{details.summary}</p>}
                {details.content && <details className="recruitment-disclosure"><summary>정리된 공고 내용</summary><p className="recruitment-content">{details.content}</p></details>}
                {safeLink(details.url) && <a className="recruitment-source" href={details.url} target="_blank" rel="noopener noreferrer">원본 공고 열기 ↗</a>}
                {isLog && selectedReview && <ReviewActions review={selectedReview} busy={busy} onChange={state => { void changeReview(selectedReview.id, state) }} />}
                {isCheck && selectedPosting && <>
                  <div className="recruitment-section-title"><h4>조건과 확인 근거</h4><span className="recruitment-badge">{validations[selectedPosting.validation] ?? '검토 대기'}</span></div>
                  {selectedPosting.reasons.length > 0 && <p className="recruitment-reasons">{selectedPosting.reasons.map(reason => { const [field] = reason.split(':'); return reason.replace(field, fields[field] ?? field) }).join(' · ')}</p>}
                  {!editing ? <><FactsView facts={details.facts ?? {}} /><button type="button" disabled={busy} onClick={() => { setEvidence(structuredClone(details.facts ?? {})); setEditing(true) }}>확인한 근거 수정</button></>
                    : <form className="recruitment-evidence" onSubmit={event => { event.preventDefault(); void save() }}><p>확인한 항목만 입력하세요. 빈 값은 미확인으로 남아요.</p>{Object.entries(fields).map(([field, name]) => {
                      const f = evidence[field] ?? { value: null, url: '', quote: '' }
                      return <fieldset key={field}><legend>{name}</legend>
                        <label>값{['javaBackend', 'accepting', 'companyType'].includes(field) ? <select aria-label={`${name} 값`} value={f.value == null ? '' : String(f.value)} onChange={e => editFact(field, 'value', e.target.value === '' ? null : field === 'companyType' ? e.target.value : e.target.value === 'true')}>
                          <option value="">미확인</option>{field === 'companyType' ? <><option value="SME">중소기업</option><option value="MID">중견기업</option><option value="LARGE">대기업</option><option value="OTHER">기타</option></> : <><option value="true">예</option><option value="false">아니요</option></>}
                        </select> : <input aria-label={`${name} 값`} type={field === 'deadline' ? 'date' : 'number'} min="0" step={field === 'rating' ? '0.1' : '1'} value={f.value == null ? '' : String(f.value)} onChange={e => editFact(field, 'value', !e.target.value ? null : field === 'deadline' ? e.target.value : Number(e.target.value))} />}</label>
                        <label>출처 주소<input type="url" value={f.url} onChange={e => editFact(field, 'url', e.target.value)} /></label><label>확인한 원문<textarea rows={2} maxLength={1000} value={f.quote} onChange={e => editFact(field, 'quote', e.target.value)} /></label>
                      </fieldset>
                    })}<div className="recruitment-actions"><button type="submit" disabled={busy}>저장하고 재검토</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>취소</button></div></form>}
                </>}
              </>}
            </section>
          </div>
          {current.id === 'SEARCH' && <details className="recruitment-disclosure"><summary>분석한 공고 일괄 접수</summary><p>하루 최대 10개 기업을 접수해요. 채팅에서 정리한 공고 배열을 붙여 넣으세요.</p><label>정형 공고 배열<textarea aria-label="정형 공고 배열" rows={5} value={imports} onChange={e => setImports(e.target.value)} /></label><button type="button" disabled={busy || !imports.trim()} onClick={() => { void importBatch() }}>공고 접수</button></details>}
          {isLog && <details className="recruitment-disclosure"><summary>마감 정리와 일일 보고</summary><p>마감된 원문은 정리하고 지원·보류 기록은 남겨요.</p><button type="button" disabled={busy} onClick={() => { void run('REPORT') }}>마감 정리·보고 갱신</button><PagedList items={data.reports} label="일일 보고서">{visible => <ul className="recruitment-reports">{visible.map(r => <li key={r.work_date}><strong>{r.work_date}</strong><span>신규 {r.summary.new_today ?? 0} · 활성 {r.summary.active ?? 0} · 마감 {r.summary.expired_today ?? 0}</span></li>)}</ul>}</PagedList></details>}
          <details className="recruitment-disclosure"><summary>{current.name} 업무 이력 <span>{jobs.length}건</span></summary><JobHistory jobs={jobs} busy={busy} onRetry={(task, date) => { void run(task, date) }} /></details>
        </>}
      </>}
    </div>
    <footer className="recruitment-footer">{current.name} 담당 · 공고는 10초마다 갱신돼요. 읽음·지원 기록은 직접 선택할 때만 바뀌어요.</footer>
  </dialog>
}

/**
 * 공고 목록의 기업·제목·요약 정보만 표시한다.
 * @author seulgae
 * @version 1.0, 선택 가능한 공고 목록 카드
 * @see "None"
 * @param props 공고와 선택 상태·콜백
 * @returns 공고 선택 버튼
 */
function PostingCard({ details, selected, badge, onSelect }: { details: Posting['details']; selected: boolean; badge: string; onSelect: () => void }) {
  return <button type="button" className="recruitment-card" aria-pressed={selected} onClick={onSelect}><span className="recruitment-card-top"><span>{details.company}</span><small className="recruitment-badge">{badge}</small></span><strong>{details.title}</strong><span className="recruitment-card-meta">{details.region ?? '지역 미확인'} · {details.career ?? '경력 미확인'}</span></button>
}

/**
 * 체크가 확인할 조건 값과 출처를 접어서 표시한다.
 * @author seulgae
 * @version 1.0, 조건별 요약과 확인 근거
 * @see "None"
 * @param props 확인된 조건
 * @returns 조건 표와 원문 근거
 */
function FactsView({ facts }: { facts: Record<string, Fact> }) {
  return <dl className="recruitment-facts">{Object.entries(fields).map(([key, name]) => {
    const f = facts[key], value = f?.value
    const text = value == null ? '미확인' : typeof value === 'boolean' ? value ? '예' : '아니요' : key === 'companyType' ? ({ SME: '중소기업', MID: '중견기업', LARGE: '대기업', OTHER: '기타' }[String(value)] ?? String(value)) : `${value}${key === 'employees' ? '명' : key === 'probationMonths' ? '개월' : key === 'rating' ? '점' : ''}`
    return <div key={key} className={value == null ? 'is-unknown' : ''}><dt>{name}</dt><dd>{text}{f && <details><summary>확인 근거</summary>{safeLink(f.url) && <a href={f.url} target="_blank" rel="noopener noreferrer">출처 열기 ↗</a>}<blockquote>{f.quote}</blockquote><small>{when(f.checkedAt)}</small></details>}</dd></div>
  })}</dl>
}

/**
 * 로그가 기록하는 읽음·확인·지원·보류 단계를 순서대로 안내한다.
 * @author seulgae
 * @version 1.0, 사용자가 선택하는 지원 관리 단계
 * @see "None"
 * @param props 검토 기록과 처리 상태·변경 콜백
 * @returns 현재 상태와 가능한 다음 단계
 */
function ReviewActions({ review, busy, onChange }: { review: Review; busy: boolean; onChange: (state: string) => void }) {
  return <section className="recruitment-review-actions" aria-label="지원 상태 관리"><h4>{REVIEW_STATE[review.state] ?? '상태 확인 필요'}</h4><p>마지막 기록 · {when(review.updated_at)}</p>
    {review.collection_id == null ? <p>마감된 공고의 보존 기록이에요.</p> : <div className="recruitment-actions">
      {review.state === 'NEW' && <button type="button" disabled={busy} onClick={() => onChange('READ')}>읽었어요</button>}
      {review.state === 'READ' && <button type="button" disabled={busy} onClick={() => onChange('CONFIRMED')}>내용 확인 완료</button>}
      {['CONFIRMED', 'HOLD'].includes(review.state) && <button type="button" disabled={busy} onClick={() => onChange('APPLIED')}>지원 완료로 기록</button>}
      {review.state === 'CONFIRMED' && <button type="button" disabled={busy} onClick={() => onChange('HOLD')}>지원 보류</button>}
    </div>}<small>지원 완료는 직접 입사지원한 사실을 남기는 기록이에요.</small>
  </section>
}

/**
 * 현재 담당자 업무만 최근 기록과 재시도 버튼으로 표시한다.
 * @author seulgae
 * @version 1.0, 담당자별 업무 이력
 * @see "None"
 * @param props 담당 업무 기록과 재시도 콜백
 * @returns 5건씩 나눈 업무 이력
 */
function JobHistory({ jobs, busy, onRetry }: { jobs: Job[]; busy: boolean; onRetry: (task: string, date?: string) => void }) {
  return <PagedList items={jobs} label="담당 업무 이력">{visible => <ul className="recruitment-history">{visible.map(j => <li key={`${j.work_date}-${j.task}`}><div><strong>{j.task === 'SEARCH' ? '접수 확인' : j.task === 'CHECK' ? '조건 검토' : j.task === 'REGISTER' ? '공고 반영' : '마감 정리·보고'}</strong><span>{STATE[j.state] ?? '상태 확인 필요'} · {j.processed}건</span></div><small>{when(j.finished_at ?? j.started_at)}</small>{['FAILED', 'UNAVAILABLE', 'WORKING'].includes(j.state) && <button type="button" disabled={busy} onClick={() => onRetry(j.task, j.work_date)}>다시 실행</button>}</li>)}{jobs.length === 0 && <li>아직 실행 기록이 없어요.</li>}</ul>}</PagedList>
}
