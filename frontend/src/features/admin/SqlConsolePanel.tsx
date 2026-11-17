import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchTables, isReadOnly, runSql, tableQuery } from './adminApi'
import type { DbTable, SqlResult } from './adminApi'
import { playSfx } from '../../audio/AudioManager'
import '../research/components/ResearchPanel.css'
import './sqlConsole.css'

/**
 * 관리자실 슈퍼컴퓨터의 쿼리 콘솔. 왼쪽에 모든 테이블 이름, 오른쪽에 SQL 입력과 결과 표.
 * 조회가 아닌 쿼리(INSERT·UPDATE·DELETE 등)는 실행 전에 한 번 더 묻는다. Ctrl(⌘)+Enter로 실행한다.
 *
 * @author seulgae
 * @version 1.0, 관리자실 쿼리 콘솔
 * @see "None"
 * @param props 닫기 콜백
 * @returns 쿼리 콘솔 모달
 */
export default function SqlConsolePanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [tables, setTables] = useState<DbTable[] | null>(null)
  const [filter, setFilter] = useState('')
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<SqlResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])
  useEffect(() => { fetchTables().then(setTables).catch(cause => setError(cause instanceof Error ? cause.message : '테이블 목록을 불러오지 못했어요.')) }, [])

  const shown = useMemo(() => (tables ?? []).filter(table => `${table.schema}.${table.name}`.includes(filter.trim().toLowerCase())), [tables, filter])

  const pick = (table: DbTable) => { setSql(tableQuery(table)); editorRef.current?.focus() }

  const run = async () => {
    if (busy || !sql.trim()) return
    if (!isReadOnly(sql) && !window.confirm('운영 DB의 데이터를 바꾸는 쿼리예요. 실행하면 되돌릴 수 없어요. 실행할까요?')) return
    setBusy(true); setError(null)
    try {
      const next = await runSql(sql)
      setResult(next)
      playSfx('success', { volume: 0.5 })
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : '실행하지 못했어요.')
      playSfx('error', { volume: 0.5 })
    } finally { setBusy(false) }
  }

  return (
    <dialog ref={dialogRef} className="research-panel sql-console" aria-labelledby="sql-console-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">ADMIN / PRODUCTION DB</p>
          <h2 id="sql-console-title">쿼리 콘솔</h2>
          <p className="sql-help">운영 DB에 바로 실행돼요. 한 번에 한 문장, 5초 제한, 결과는 최대 200행이에요.</p>
        </div>
        <button type="button" className="research-close" onClick={onClose}>닫기</button>
      </header>
      <div className="sql-layout">
        <aside className="sql-tables" aria-label="테이블 목록">
          <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="테이블 찾기" aria-label="테이블 찾기" />
          {!tables && !error && <p role="status">불러오는 중…</p>}
          <ul>
            {shown.map(table => (
              <li key={`${table.schema}.${table.name}`}>
                <button type="button" onClick={() => pick(table)} title={`${table.schema}.${table.name} 조회 쿼리 넣기`}>
                  <small>{table.schema}.</small>{table.name}{table.type === 'VIEW' && <em> view</em>}
                </button>
              </li>
            ))}
          </ul>
          {tables && <p className="sql-count">{tables.length}개</p>}
        </aside>
        <section className="sql-main">
          <textarea ref={editorRef} value={sql} spellCheck={false} autoFocus aria-label="SQL"
            placeholder={'SELECT * FROM lab.guestbook_entries LIMIT 100;'}
            onChange={event => setSql(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void run() } }} />
          <div className="sql-actions">
            <button type="button" className="board-primary" disabled={busy || !sql.trim()} onClick={() => void run()}>{busy ? '실행 중…' : '실행 (Ctrl+Enter)'}</button>
            {result && <span role="status">{result.updated !== null ? `${result.updated}행 변경됨` : `${result.rows.length}행${result.truncated ? ' (200행에서 잘림)' : ''}`} · {result.millis}ms</span>}
          </div>
          {error && <pre className="sql-error" role="alert">{error}</pre>}
          {result && result.columns.length > 0 && (
            <div className="sql-result">
              <table>
                <thead><tr>{result.columns.map((column, index) => <th key={index}>{column}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>{row.map((cell, index) => <td key={index} className={cell === null ? 'sql-null' : undefined}>{cell ?? 'NULL'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </dialog>
  )
}
