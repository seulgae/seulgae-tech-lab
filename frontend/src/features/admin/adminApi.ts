/**
 * 관리자실 쿼리 콘솔 API. 서버가 매 요청 관리자 회원인지 확인한다.
 */
export type DbTable = { schema: string; name: string; type: 'TABLE' | 'VIEW' }
export type SqlResult = { columns: string[]; rows: (string | null)[][]; truncated: boolean; updated: number | null; millis: number }

/** 주석을 뺀 첫 단어로 읽기 전용 쿼리인지 본다. 아니면 실행 전에 한 번 더 확인한다. */
export function isReadOnly(sql: string) {
  const text = sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').trim().toLowerCase()
  if (/^(select|show|table|values|explain)\b/.test(text)) return !/^explain\s+(\(.*\banalyze\b|analyze\b)/.test(text)
  if (/^with\b/.test(text)) return !/\b(insert|update|delete|merge|truncate)\b/.test(text)
  return false
}

/** 식별자를 그대로 쓸 수 있으면 그대로, 아니면 큰따옴표로 감싼다. */
export const quoteIdent = (name: string) => /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`
/** 목록에서 테이블을 누르면 채울 조회 쿼리 */
export const tableQuery = (table: DbTable) => `SELECT * FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)} LIMIT 100;`

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(response.status === 401 ? '로그인이 필요해요.' : response.status === 403 ? '관리자만 쓸 수 있어요.' : body?.error ?? `요청에 실패했어요(${response.status}).`)
  }
  return response.json() as Promise<T>
}

export const fetchTables = () => request<DbTable[]>('/api/admin/tables')
export const runSql = (sql: string) => request<SqlResult>('/api/admin/sql', { method: 'POST', body: JSON.stringify({ sql }) })
