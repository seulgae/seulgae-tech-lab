import { useEffect, useRef, useState } from 'react'
import { TECH_BOOKS } from './techBooks'
import { ADMIN_BOOKS } from './adminBooks'
import '../../components/panel.css'
import './books.css'

/**
 * 로비 책장에서 꺼낸 연구소 기술 노트를 읽는 모달이다. 책등으로 책을 바꾸고 ←/→ 키나 버튼으로 쪽을 넘긴다.
 *
 * @author seulgae
 * @version 1.0, 연구 아이디어 일지 #2 책장 상호작용
 * @see "None"
 * 관리자실 책장(admin)에서는 운영 도서관(어떤 테이블로 무엇을 관리하는지 표로 적은 책)을 보여 준다.
 * @param props 닫기 콜백, 관리자실 책장인지
 * @returns 책 읽기 모달
 */
export default function BookPanel({ onClose, admin = false }: { onClose: () => void; admin?: boolean }) {
  const books = admin ? ADMIN_BOOKS : TECH_BOOKS
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [bookIndex, setBookIndex] = useState(0)
  const [page, setPage] = useState(0)
  const book = books[bookIndex]!
  const current = book.pages[page]!

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  const open = (index: number) => { setBookIndex(index); setPage(0) }
  const turn = (delta: number) => setPage(value => Math.min(Math.max(value + delta, 0), book.pages.length - 1))

  return (
    <dialog ref={dialogRef} className={`research-panel book-panel${admin ? ' book-panel-admin' : ''}`} aria-labelledby="book-panel-title"
      onCancel={event => { event.preventDefault(); onClose() }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1) }
        if (event.key === 'ArrowRight') { event.preventDefault(); turn(1) }
      }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">{admin ? 'CONTROL ROOM / 운영 도서관' : 'SEULGAE TECH LAB / LIBRARY'}</p>
          <h2 id="book-panel-title">{book.title}</h2>
          <p className="book-subtitle">{book.subtitle}</p>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <nav className="book-spines" aria-label="책장">
        {books.map((item, index) => (
          <button key={item.id} type="button" className="book-spine" style={{ borderLeftColor: item.color }}
            aria-pressed={index === bookIndex} onClick={() => open(index)}>{item.title}</button>
        ))}
      </nav>
      <article className="book-page" style={{ borderTopColor: book.color }} aria-live="polite">
        <h3>{current.heading}</h3>
        {current.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {current.table && (
          <div className="book-table-wrap">
            <table className="book-table">
              <thead><tr>{current.table.head.map(cell => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
              <tbody>{current.table.rows.map(row => <tr key={row.join('|')}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {current.code && <pre className="book-code"><code>{current.code}</code></pre>}
      </article>
      <div className="book-turn">
        <button type="button" onClick={() => turn(-1)} disabled={page === 0}>← 이전 쪽</button>
        <span>{page + 1} / {book.pages.length}</span>
        <button type="button" onClick={() => turn(1)} disabled={page === book.pages.length - 1}>다음 쪽 →</button>
      </div>
      <p className="research-footer">←/→ 키로 쪽을 넘기고, ESC로 책장에 돌려놓아요.</p>
    </dialog>
  )
}
