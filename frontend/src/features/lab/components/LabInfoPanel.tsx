import { useEffect, useRef, useState } from 'react'
import { fetchBuildInfo, fetchLabStatus } from '../api/labApi'
import { formatUptime } from '../model/labTypes'
import type { BuildInfo, LabPanelKind, LabStatus } from '../model/labTypes'
import '../../research/components/ResearchPanel.css'
import './LabInfoPanel.css'

type Props = { kind: LabPanelKind; onClose: () => void }
const TITLES: Record<LabPanelKind, { eyebrow: string; title: string }> = {
  'server-status': { eyebrow: 'SEULGAE TECH LAB / SERVER ROOM', title: '서버 상태' },
  'build-info': { eyebrow: 'SEULGAE TECH LAB / DEVELOPMENT', title: '빌드 정보' },
}
const POLL_MS = 3000

/**
 * 서버실 랙의 실시간 상태와 개발 연구실 컴퓨터의 빌드 정보를 보여 주는 모달이다.
 *
 * @author seulgae
 * @version 1.0, 방별 상호작용 패널
 * @see "None"
 * @param props 패널 종류와 닫기 콜백
 * @returns 서버 상태 또는 빌드 정보 모달
 */
export default function LabInfoPanel({ kind, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<LabStatus | null>(null)
  const [build, setBuild] = useState<BuildInfo | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  // 서버 상태는 패널이 열린 동안만 주기적으로 갱신하고, 닫히면 요청과 타이머를 함께 정리한다.
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      const request = kind === 'server-status'
        ? fetchLabStatus(controller.signal).then(setStatus)
        : fetchBuildInfo(controller.signal).then(setBuild)
      request.then(() => { if (!controller.signal.aborted) setError(false) })
        .catch(() => { if (!controller.signal.aborted) setError(true) })
        .finally(() => { if (!controller.signal.aborted && kind === 'server-status') timer = setTimeout(load, POLL_MS) })
    }
    load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [kind, retry])

  const { eyebrow, title } = TITLES[kind]
  const loading = !error && (kind === 'server-status' ? !status : !build)
  return (
    <dialog ref={dialogRef} className="research-panel lab-panel" aria-labelledby="lab-panel-title"
      onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">{eyebrow}</p>
          <h2 id="lab-panel-title">{title}</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <section aria-live="polite" aria-busy={loading}>
        {loading && <p role="status">정보를 불러오는 중…</p>}
        {error && <p role="alert">정보를 불러오지 못했습니다. <button type="button" onClick={() => { setError(false); setRetry(n => n + 1) }}>다시 시도</button></p>}
        {kind === 'server-status' && status && <>
          <dl className="lab-stats">
            <div><dt>상태</dt><dd className={status.status === 'UP' ? 'lab-up' : 'lab-down'}>{status.status}</dd></div>
            <div><dt>가동 시간</dt><dd>{formatUptime(status.uptimeSeconds)}</dd></div>
            <div><dt>접속자</dt><dd>{status.onlinePlayers} / {status.maxPlayers}</dd></div>
            <div><dt>JVM 힙</dt><dd>{status.memory.usedMb} / {status.memory.maxMb} MiB</dd></div>
          </dl>
          <meter className="lab-meter" min={0} max={status.memory.maxMb} value={status.memory.usedMb} aria-label="JVM 힙 사용량" />
          <p className="research-footer">3초마다 갱신 · {new Date(status.serverTime).toLocaleTimeString('ko-KR')}</p>
        </>}
        {kind === 'build-info' && build && <dl className="lab-stats">
          <div><dt>버전</dt><dd>{build.version}</dd></div>
          <div><dt>커밋</dt><dd><code>{build.commit}</code></dd></div>
          <div><dt>빌드 시각</dt><dd>{build.builtAt ? new Date(build.builtAt).toLocaleString('ko-KR') : '로컬 빌드'}</dd></div>
          <div><dt>Java</dt><dd>{build.javaVersion}</dd></div>
        </dl>}
      </section>
      <p className="research-footer">ESC 또는 닫기 버튼으로 돌아갑니다.</p>
    </dialog>
  )
}
