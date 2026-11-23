import { useEffect, useRef, useState } from 'react'
import { fetchCapacity } from '../api/labApi'
import { formatUptime } from '../model/labTypes'
import { PROBE_STATES, RACKS, formatMb, sparkline } from '../model/capacity'
import type { Capacity, Point, RackId } from '../model/capacity'
import '../../research/components/ResearchPanel.css'
import './LabInfoPanel.css'

const POLL_MS = 5000
const time = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

/** 최근 15분 추이(퍼센트) */
function Trend({ history, label }: { history: Point[]; label: string }) {
  const path = sparkline(history)
  if (!path) return <p className="rack-note">추이는 수집이 두 번 이상 쌓이면 보여요.</p>
  return (
    <figure className="rack-trend">
      <svg viewBox="0 0 240 40" role="img" aria-label={`${label} 최근 추이`} preserveAspectRatio="none">
        <line x1="0" x2="240" y1="8" y2="8" className="rack-trend-warn" />
        <path d={path} />
      </svg>
      <figcaption>최근 {history.length}회(30초 간격) · 점선 80%</figcaption>
    </figure>
  )
}

function Gauge({ value, label, warning }: { value: number; label: string; warning: boolean }) {
  return (
    <div className={`rack-gauge${warning ? ' warn' : ''}`}>
      <strong>{value.toFixed(1)}<small>%</small></strong>
      <meter min={0} max={100} low={60} high={80} optimum={0} value={value} aria-label={label} />
      {warning && <span role="status">80% 초과</span>}
    </div>
  )
}

/**
 * 서버실 랙 하나의 용량 조사 화면. 1번 CPU, 2번 메모리, 3번 JVM 힙, 4번 가동시간을 나눠 보여 주고 5초마다 다시 읽는다.
 *
 * @author seulgae
 * @version 1.0, 서버실 랙 용량 조사
 * @see "docs/server-capacity.md"
 * @param props 랙 id와 닫기 콜백
 * @returns 랙 모달
 */
export default function ServerRackPanel({ rack, onClose }: { rack: RackId; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<Capacity | null>(null)
  const [error, setError] = useState(false)
  const info = RACKS[rack]

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => fetchCapacity(controller.signal)
      .then(value => { setData(value); setError(false) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) timer = setTimeout(load, POLL_MS) })
    load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [])

  const host = data?.probe.state === 'OK' || !!data?.memory
  const probeNote = data && data.probe.state !== 'OK' && (
    <p className="rack-note" role="status">{PROBE_STATES[data.probe.state] ?? data.probe.state}{data.probe.collectedAt ? ` · 마지막 성공 ${time(data.probe.collectedAt)}` : ''}</p>
  )

  return (
    <dialog ref={dialogRef} className="research-panel lab-panel rack-panel" aria-labelledby="rack-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SERVER ROOM / RACK {info.no}</p>
          <h2 id="rack-title">{info.no}번 랙 · {info.title}</h2>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <section aria-live="polite" aria-busy={!data && !error}>
        {!data && !error && <p role="status">수집값을 불러오는 중…</p>}
        {error && !data && <p role="alert">정보를 불러오지 못했어요. 잠시 후 다시 시도해요.</p>}

        {data && info.topic === 'cpu' && <>
          {probeNote}
          {host && <Gauge value={data.cpu.usedPercent} label="호스트 CPU 사용률" warning={data.cpu.warning} />}
          <dl className="lab-stats">
            {host && <>
              <div><dt>사용자(user)</dt><dd>{data.cpu.user}%</dd></div>
              <div><dt>시스템(system)</dt><dd>{data.cpu.system}%</dd></div>
              <div><dt>입출력 대기(iowait)</dt><dd>{data.cpu.ioWait}%</dd></div>
              <div><dt>부하 평균 1·5·15분</dt><dd>{data.cpu.load1} · {data.cpu.load5} · {data.cpu.load15}</dd></div>
              <div><dt>코어당 부하</dt><dd>{data.cpu.loadPerCore} <small>(1.0이면 꽉 참)</small></dd></div>
            </>}
            <div><dt>코어 수</dt><dd>{data.cpu.cores}개</dd></div>
            <div><dt>JVM 프로세스 CPU</dt><dd>{data.cpu.jvmProcessPercent}%</dd></div>
          </dl>
          {host && <Trend history={data.cpu.history} label="CPU" />}
        </>}

        {data && info.topic === 'memory' && <>
          {probeNote}
          {data.memory ? <>
            <Gauge value={data.memory.usedPercent} label="호스트 메모리 사용률" warning={data.memory.warning} />
            <dl className="lab-stats">
              <div><dt>전체</dt><dd>{formatMb(data.memory.totalMb)}</dd></div>
              <div><dt>사용</dt><dd>{formatMb(data.memory.usedMb)}</dd></div>
              <div><dt>가용(available)</dt><dd>{formatMb(data.memory.availableMb)}</dd></div>
              <div><dt>버퍼·캐시</dt><dd>{formatMb(data.memory.buffCacheMb)}</dd></div>
              <div><dt>스왑</dt><dd>{data.memory.swapTotalMb ? `${formatMb(data.memory.swapUsedMb)} / ${formatMb(data.memory.swapTotalMb)}` : '없음'}</dd></div>
              <div><dt>JVM 힙 최대 / 전체</dt><dd>{(data.heap.maxMb / Math.max(1, data.memory.totalMb) * 100).toFixed(1)}%</dd></div>
            </dl>
            <p className="rack-note">사용률은 (전체 − 가용) ÷ 전체예요. 버퍼·캐시는 필요하면 돌려받을 수 있어 가용으로 봐요.</p>
            <Trend history={data.memory.history} label="메모리" />
          </> : <p className="rack-note">호스트 메모리는 SSH 수집이 성공하면 보여요.</p>}
        </>}

        {data && info.topic === 'heap' && <>
          <Gauge value={data.heap.usedPercent} label="JVM 힙 사용률" warning={data.heap.warning} />
          <dl className="lab-stats">
            <div><dt>사용</dt><dd>{formatMb(data.heap.usedMb)}</dd></div>
            <div><dt>확보(committed)</dt><dd>{formatMb(data.heap.committedMb)}</dd></div>
            <div><dt>최대(max)</dt><dd>{formatMb(data.heap.maxMb)}</dd></div>
            <div><dt>힙 외(non-heap)</dt><dd>{formatMb(data.heap.nonHeapMb)}</dd></div>
            <div><dt>GC 횟수</dt><dd>{data.heap.gcCount.toLocaleString('ko-KR')}회</dd></div>
            <div><dt>GC 누적 시간</dt><dd>{(data.heap.gcMillis / 1000).toFixed(1)}초{data.uptime.jvmSeconds > 0 ? ` (${(data.heap.gcMillis / 10 / data.uptime.jvmSeconds).toFixed(2)}%)` : ''}</dd></div>
            <div><dt>스레드 (최고)</dt><dd>{data.heap.threads} ({data.heap.peakThreads})</dd></div>
          </dl>
          <p className="rack-note">게임 백엔드 JVM 값이라 SSH 설정 없이도 보여요. GC 누적 시간 괄호는 가동시간 대비 비율이에요.</p>
        </>}

        {data && info.topic === 'uptime' && <>
          <dl className="lab-stats">
            <div><dt>서버 가동시간</dt><dd>{data.uptime.hostSeconds === null ? '—' : formatUptime(data.uptime.hostSeconds)}</dd></div>
            <div><dt>서버 부팅</dt><dd>{time(data.uptime.hostBootAt)}</dd></div>
            <div><dt>JVM 가동시간</dt><dd>{formatUptime(data.uptime.jvmSeconds)}</dd></div>
            <div><dt>JVM 시작(배포)</dt><dd>{time(data.uptime.jvmStartAt)}</dd></div>
            <div><dt>호스트 수집</dt><dd className={data.probe.state === 'OK' ? 'lab-up' : 'lab-down'}>{PROBE_STATES[data.probe.state] ?? data.probe.state}</dd></div>
            <div><dt>마지막 수집</dt><dd>{time(data.probe.collectedAt)}</dd></div>
          </dl>
          <p className="rack-note">JVM 시작 시각은 마지막 배포·재시작 시각과 같아요.</p>
        </>}

        {data && <p className="research-footer">5초마다 다시 읽음 · 호스트 값은 30초마다 수집 · {time(data.serverTime)}</p>}
      </section>
    </dialog>
  )
}
