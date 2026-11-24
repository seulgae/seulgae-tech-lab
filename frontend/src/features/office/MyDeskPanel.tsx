import { useEffect, useRef, useState } from 'react'
import { BoardError } from '../boards/boardsApi'
import { LOGIN_URL, useAuth } from '../auth/authStore'
import { playSfx } from '../../audio/AudioManager'
import { TIRED_STATUS, inventoryStore } from '../inventory/inventoryStore'
import { tiredMessage } from '../rules/rulesStore'
import { answerJava, claimDailyReward, fetchDesk, javaString } from './officeApi'
import type { DeskView, JavaAnswer, JavaProblem } from './officeApi'
import { IdeaBoard } from './IdeaBoard'
import HandoverWindow from './HandoverWindow'
import { QaBoard } from './QaBoard'
import '../../components/panel.css'
import './office.css'

type Window = 'mail' | 'handover' | 'idea' | 'qa' | 'dev' | null

/** 바탕화면 아이콘(메일·개발은 회원 전용, 게시판은 누구나 읽는다) */
const ICONS: readonly { id: Exclude<Window, null>; icon: string; label: string; memberOnly: boolean }[] = [
  { id: 'mail', icon: '📧', label: '메일', memberOnly: true },
  { id: 'handover', icon: '📄', label: '인수인계서', memberOnly: false },
  { id: 'idea', icon: '💡', label: '아이디어', memberOnly: false },
  { id: 'qa', icon: '🐞', label: 'QA', memberOnly: false },
  { id: 'dev', icon: '☕', label: '개발', memberOnly: true },
]
const TITLES: Record<Exclude<Window, null>, string> = { mail: '📧 메일', handover: '📄 인수인계서', idea: '💡 아이디어 기획 게시판', qa: '🐞 QA 게시판', dev: '☕ 개발' }

/**
 * 서비스 연구실 왼쪽 맨 아래 컴퓨터: 내 자리. 모니터 바탕화면에서 아이콘을 눌러 창을 연다.
 * 아이디어·QA: 아이디어 기획 게시판과 QA 게시판(등록 → 조치 중 → 조치 완료). 비회원은 읽기만 한다.
 * 메일: 오늘 해야 할 업무(게임 안에서 실제로 하는 일)가 자동으로 체크되고, 다 하면 보상을 받는다.
 * 개발: 자바 printf 형식 문자열을 채워 실행하면 서버가 실제 String.format으로 출력해 채점한다.
 *
 * @author seulgae
 * @version 1.1, 내 자리 컴퓨터에 인수인계서 추가
 * @see "None"
 * @param props 닫기 콜백
 * @returns 모니터 모달
 */
export default function MyDeskPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const auth = useAuth()
  const [desk, setDesk] = useState<DeskView | null>(null)
  const [opened, setOpened] = useState<Window>(null)
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => { if (auth.member) fetchDesk().then(setDesk).catch(() => setError('컴퓨터에 접속하지 못했어요.')) }, [auth.member])
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 30_000); return () => window.clearInterval(timer) }, [])

  const left = desk ? desk.tasks.filter(task => !task.done).length : 0
  const openWindow = (next: Window) => { setOpened(next); playSfx('click', { volume: 0.5 }); if (next === 'mail' && auth.member) void fetchDesk().then(setDesk).catch(() => undefined) }

  return (
    <dialog ref={dialogRef} className="research-panel desk-panel" aria-labelledby="desk-title"
      onCancel={event => { event.preventDefault(); if (opened) setOpened(null); else onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SERVICE LAB / MY DESK</p>
          <h2 id="desk-title">내 자리 컴퓨터</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose}>닫기</button>
      </header>

      {/* 모니터: 바탕화면 아이콘, 창, 작업 표시줄 */}
      <div className="desk-monitor">
        <div className="desk-screen">
          <div className="desk-icons">
            {ICONS.map(entry => (
              <button key={entry.id} type="button" onClick={() => openWindow(entry.id)}
                aria-label={entry.id === 'mail' && desk ? `메일: 오늘 할 업무 ${left}개 남음` : entry.label}>
                <span className="desk-icon">{entry.icon}{entry.id === 'mail' && desk && left > 0 && <b>{left}</b>}</span>{entry.label}
              </button>
            ))}
          </div>
          {error && <p className="desk-error" role="alert">{error}</p>}
          {opened && ICONS.find(entry => entry.id === opened)?.memberOnly && !auth.member && (
            <section className="desk-window" aria-label="로그인 필요">
              <header><span>{TITLES[opened]}</span><button type="button" onClick={() => setOpened(null)} aria-label="창 닫기">✕</button></header>
              <p className="desk-window-body">로그인하면 메일과 개발 연습을 쓸 수 있어요. <a className="auth-kakao" href={LOGIN_URL}>카카오 로그인</a></p>
            </section>
          )}
          {opened === 'handover' && <HandoverWindow onClose={() => setOpened(null)} />}
          {opened === 'mail' && desk && <MailWindow desk={desk} onDesk={setDesk} onClose={() => setOpened(null)} />}
          {opened === 'dev' && desk && <DevWindow desk={desk} onDesk={setDesk} onClose={() => setOpened(null)} />}
          {(opened === 'idea' || opened === 'qa') && (
            <section className="desk-window desk-board" aria-label={TITLES[opened]}>
              <header><span>{TITLES[opened]}</span><button type="button" onClick={() => setOpened(null)} aria-label="창 닫기">✕</button></header>
              <div className="desk-window-body">{opened === 'idea' ? <IdeaBoard /> : <QaBoard />}</div>
            </section>
          )}
        </div>
        <div className="desk-taskbar">
          <span>🟦 SeulgaeOS</span>
          <span>{opened ? TITLES[opened] : ''}</span>
          <span>{clock.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <p className="research-footer">아이콘을 눌러 창을 열어요. ESC로 창을 닫고, 컴퓨터 화면을 닫은 뒤 이동하면 자리에서 일어나요.</p>
    </dialog>
  )
}

/**
 * 메일 창: 팀장님이 보낸 오늘 업무. 체크는 서버 기록으로 자동, 다 하면 보상 받기.
 *
 * @param props 화면 값, 바꾸기, 닫기
 * @returns 메일 창
 */
function MailWindow({ desk, onDesk, onClose }: { desk: DeskView; onDesk: (desk: DeskView) => void; onClose: () => void }) {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const allDone = desk.tasks.every(task => task.done)
  const claim = async () => {
    setBusy(true)
    try {
      const next = await claimDailyReward()
      onDesk(next)
      setMessage(next.promotedTo ? `수고했어요! 동전 ${desk.reward}원을 받았어요. 🎉 ${next.promotedTo}(으)로 승진! HP·기력 최대치가 늘고 가득 찼어요.` : `수고했어요! 동전 ${desk.reward}원을 받았어요. 일 완료 +1`)
      playSfx(next.promotedTo ? 'success' : 'coin', { volume: 0.7 }); void inventoryStore.refresh()
    }
    catch (cause) { setMessage(cause instanceof BoardError && cause.status === 409 ? '아직 다 하지 않았거나 이미 받았어요.' : '보상을 받지 못했어요.') }
    finally { setBusy(false) }
  }
  return (
    <section className="desk-window" aria-label="메일">
      <header><span>📧 받은 메일 · 오늘 할 업무</span><button type="button" onClick={onClose} aria-label="메일 닫기">✕</button></header>
      <div className="desk-window-body">
        <p className="desk-mail-from"><strong>보낸 사람</strong> 연구소 본부 · <strong>제목</strong> 오늘도 연구소를 잘 부탁해요</p>
        <ul className="desk-tasks">
          {desk.tasks.map(task => (
            <li key={task.code} className={task.done ? 'done' : ''}>
              <span aria-hidden="true">{task.done ? '☑' : '☐'}</span>
              <span>{task.title}<small>{task.where}</small></span>
            </li>
          ))}
        </ul>
        <p className="desk-note">실제로 하면 자동으로 체크돼요. 다시 열면 새로 확인해요.</p>
        {desk.rewardClaimed
          ? <p className="desk-ok">✔ 오늘 업무 보상을 받았어요. 내일 또 만나요!</p>
          : <button type="button" className="desk-primary" disabled={!allDone || busy} onClick={() => void claim()}>{allDone ? `보상 받기 🪙 ${desk.reward}` : `${desk.tasks.filter(task => !task.done).length}개 남았어요`}</button>}
        {message && <p className="desk-note" role="status">{message}</p>}
      </div>
    </section>
  )
}

/**
 * 개발 창: 자바 printf 문제를 고르고 형식 문자열을 채워 실행한다.
 *
 * @param props 화면 값, 바꾸기, 닫기
 * @returns 개발 창
 */
function DevWindow({ desk, onDesk, onClose }: { desk: DeskView; onDesk: (desk: DeskView) => void; onClose: () => void }) {
  const [problem, setProblem] = useState<JavaProblem>(desk.problems[0]!)
  const [format, setFormat] = useState('')
  const [result, setResult] = useState<JavaAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [solved, setSolved] = useState<Set<string>>(new Set())

  const pick = (next: JavaProblem) => { setProblem(next); setFormat(''); setResult(null) }
  const run = async () => {
    if (!format || busy) return
    setBusy(true)
    try {
      const answer = await answerJava(problem.id, format)
      setResult(answer)
      /* 답을 낼 때마다 기력이 들어 가방(HP·기력)을 다시 읽는다 */
      void inventoryStore.refresh()
      if (answer.correct) {
        setSolved(set => new Set(set).add(problem.id)); playSfx('success', { volume: 0.6 })
        if (answer.rewarded) { onDesk({ ...desk, javaRewardsToday: desk.javaRewardsToday + 1 }) }
      } else playSfx('error', { volume: 0.4 })
    } catch (cause) {
      const status = cause instanceof BoardError ? cause.status : 0
      setResult({ problemId: problem.id, format, output: null, correct: false, rewarded: false,
        error: status === TIRED_STATUS ? tiredMessage('JAVA_ANSWER') : status === 429 ? '너무 빨리 실행했어요. 1초 뒤에 다시 눌러 주세요.' : status === 401 ? '로그인이 풀렸어요. 다시 로그인해 주세요.' : status === 400 ? '형식 문자열은 1~100자로 써 주세요.' : '실행하지 못했어요. 잠시 후 다시 해 보세요.' })
    }
    finally { setBusy(false) }
  }

  return (
    <section className="desk-window desk-dev" aria-label="개발">
      <header><span>☕ JavaPractice.java</span><button type="button" onClick={onClose} aria-label="개발 창 닫기">✕</button></header>
      <div className="desk-dev-body">
        <ol className="desk-problems" aria-label="문제">
          {desk.problems.map(entry => (
            <li key={entry.id}><button type="button" aria-pressed={entry.id === problem.id} onClick={() => pick(entry)}>{solved.has(entry.id) ? '✔ ' : ''}{entry.title}</button></li>
          ))}
        </ol>
        <div className="desk-editor">
          <p className="desk-task">{problem.description}</p>
          <p className="desk-note">형식 문자열에는 <strong>출력될 문장 전체</strong>를 쓰고, 값이 들어갈 자리에만 %s·%d 같은 서식을 넣어요. 예: <code>"이름: %s"</code></p>
          {/* 코드 편집기: printf의 형식 문자열 칸만 고친다 */}
          <pre className="desk-code"><code>
            <span className="kw">public class</span> Main {'{\n'}
            {'    '}<span className="kw">public static void</span> main(String[] args) {'{\n'}
            {'        '}System.out.printf(<input aria-label="형식 문자열" className="desk-format" value={format} maxLength={100} spellCheck={false}
              placeholder="형식 문자열" onChange={event => { setFormat(event.target.value); setResult(null) }}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void run() } }}
              style={{ width: `${Math.max(10, format.length + 2)}ch` }} />, {problem.argsCode});{'\n'}
            {'    }\n}'}
          </code></pre>
          <div className="desk-run">
            <button type="button" className="desk-primary" disabled={!format || busy} onClick={() => void run()}>▶ 실행</button>
            <small>입력하면 {javaString(format)} 로 들어가요 · 오늘 연습 보상 {desk.javaRewardsToday}/{desk.javaRewardLimit}</small>
          </div>
          <div className="desk-console" aria-live="polite">
            <p><span>기대 출력</span> <code>{problem.expected}</code></p>
            {result?.output != null && <p><span>내 출력</span> <code>{result.output}</code></p>}
            {result?.error && <p className="desk-console-error">{result.error}</p>}
            {result && (result.correct
              ? <p className="desk-ok">✔ 정답!{result.rewarded ? ' 동전 1원을 받았어요.' : ''}</p>
              : !result.error && <p className="desk-console-error">✘ 출력이 달라요. 띄어쓰기와 기호까지 맞춰 보세요.</p>)}
          </div>
          <details className="desk-hints"><summary>힌트</summary><ul>{problem.hints.map(hint => <li key={hint}>{hint}</li>)}</ul></details>
        </div>
      </div>
    </section>
  )
}
