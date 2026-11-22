import { useEffect, useState } from 'react'
import { playSfx } from '../../../audio/AudioManager'
import { TODO_TITLE_MAX, addTodo, deleteTodo, fetchTodos, setTodoDone } from '../phoneApi'
import type { Todo } from '../phoneApi'
import { isoDate, monthGrid, monthKey, seoulNow, shiftMonth } from '../phoneTime'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '요청에 실패했어요.'

/**
 * 폰 캘린더 앱: 달력에서 날짜를 고르고 그날 할 일을 적고, 끝내면 체크한다. 할 일이 있는 날에는 점이 찍힌다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(캘린더)
 * @see "None"
 * @returns 캘린더·할 일 화면
 */
export default function CalendarApp() {
  const today = seoulNow()
  const todayIso = isoDate(today.year, today.month, today.day)
  const [view, setView] = useState({ year: today.year, month: today.month })
  const [selected, setSelected] = useState(todayIso)
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchTodos(monthKey(view.year, view.month)).then(list => { if (alive) { setTodos(list); setError(null) } }).catch(cause => alive && setError(errorText(cause)))
    return () => { alive = false }
  }, [view.year, view.month])

  const move = (delta: number) => {
    const next = shiftMonth(view.year, view.month, delta)
    setView(next)
    setSelected(isoDate(next.year, next.month, 1))
  }

  const add = async () => {
    if (!title.trim()) return
    try {
      const todo = await addTodo(selected, title)
      if (todo.date.startsWith(monthKey(view.year, view.month))) setTodos(list => [...list, todo])
      setTitle(''); setError(null)
      playSfx('marker', { volume: 0.5 })
    } catch (cause) { setError(errorText(cause)) }
  }

  const toggle = async (todo: Todo) => {
    try {
      const next = await setTodoDone(todo.id, !todo.done)
      setTodos(list => list.map(item => item.id === next.id ? next : item))
      if (next.done) playSfx('success', { volume: 0.4 })
    } catch (cause) { setError(errorText(cause)) }
  }

  const remove = async (todo: Todo) => {
    try { await deleteTodo(todo.id); setTodos(list => list.filter(item => item.id !== todo.id)) } catch (cause) { setError(errorText(cause)) }
  }

  const busyDays = new Set(todos.filter(todo => !todo.done).map(todo => todo.date))
  const dayTodos = todos.filter(todo => todo.date === selected)
  const [, , selectedDay] = selected.split('-').map(Number)

  return (
    <div className="phone-app-body">
      <div className="calendar-head">
        <button type="button" aria-label="지난달" onClick={() => move(-1)}>‹</button>
        <strong>{view.year}년 {view.month}월</strong>
        <button type="button" aria-label="다음 달" onClick={() => move(1)}>›</button>
      </div>
      <table className="calendar-grid">
        <thead><tr>{WEEKDAYS.map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
        <tbody>
          {monthGrid(view.year, view.month).map((week, row) => (
            <tr key={row}>
              {week.map((day, column) => {
                if (day === null) return <td key={column} />
                const iso = isoDate(view.year, view.month, day)
                return (
                  <td key={column}>
                    <button type="button" aria-pressed={iso === selected} aria-label={`${view.month}월 ${day}일${busyDays.has(iso) ? ', 할 일 있음' : ''}`}
                      className={[iso === todayIso && 'today', iso === selected && 'selected', busyDays.has(iso) && 'busy', column === 0 && 'sunday'].filter(Boolean).join(' ')}
                      onClick={() => setSelected(iso)}>{day}</button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="phone-error" role="alert">{error}</p>}
      <section className="phone-card" aria-label="할 일">
        <h3>{view.month}월 {selectedDay}일 할 일</h3>
        {dayTodos.length === 0 && <p className="phone-muted">아직 없어요.</p>}
        <ul className="todo-list">
          {dayTodos.map(todo => (
            <li key={todo.id} className={todo.done ? 'done' : ''}>
              <label><input type="checkbox" checked={todo.done} onChange={() => void toggle(todo)} /> <span>{todo.title}</span></label>
              <button type="button" aria-label={`${todo.title} 지우기`} onClick={() => void remove(todo)}>×</button>
            </li>
          ))}
        </ul>
        <form className="phone-inline-form" onSubmit={event => { event.preventDefault(); void add() }}>
          <input aria-label="새 할 일" placeholder={`할 일 (${TODO_TITLE_MAX}자)`} maxLength={TODO_TITLE_MAX} value={title} onChange={event => setTitle(event.target.value)} />
          <button type="submit" className="phone-primary" disabled={!title.trim()}>추가</button>
        </form>
      </section>
    </div>
  )
}
