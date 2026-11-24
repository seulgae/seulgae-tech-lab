import { useState } from 'react'
import { playSfx } from '../../../audio/AudioManager'
import { HOME_ADDRESS, openSite } from '../fakeWeb'
import type { WebPage } from '../fakeWeb'

/**
 * 폰 웹 브라우저 앱: 연구소 안에서만 보이는 가짜 인터넷(뉴스·날씨·도감·길 안내). 바깥 인터넷에는 나가지 않는다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(웹 브라우저)
 * @see "None"
 * @returns 브라우저 화면
 */
export default function BrowserApp() {
  const [history, setHistory] = useState<WebPage[]>(() => [openSite(HOME_ADDRESS)])
  const page = history[history.length - 1]
  const [address, setAddress] = useState(page.address)

  const go = (target: string) => {
    const next = openSite(target)
    setHistory(list => [...list.slice(-19), next])
    setAddress(next.address)
    playSfx('click', { volume: 0.4 })
  }
  const back = () => {
    if (history.length < 2) return
    const list = history.slice(0, -1)
    setHistory(list)
    setAddress(list[list.length - 1].address)
  }

  return (
    <div className="phone-app-body browser-app">
      <form className="browser-bar" onSubmit={event => { event.preventDefault(); go(address) }}>
        <button type="button" aria-label="뒤로" onClick={back} disabled={history.length < 2}>‹</button>
        <input aria-label="주소" value={address} onChange={event => setAddress(event.target.value)} spellCheck={false} />
        <button type="button" aria-label="포털" onClick={() => go(HOME_ADDRESS)}>⌂</button>
      </form>
      <article className={`browser-page site-${page.theme}`} aria-label={page.title}>
        <h3>{page.title}</h3>
        {page.blocks.map((block, index) => {
          if (block.type === 'heading') return <h4 key={index}>{block.text}</h4>
          if (block.type === 'text') return <p key={index}>{block.text}</p>
          if (block.type === 'list') return <ul key={index}>{block.items.map(item => <li key={item}>{item}</li>)}</ul>
          if (block.type === 'table') return (
            <div key={index} className="browser-table-wrap">
              <table className="browser-table">
                <thead><tr>{block.head.map(cell => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
                <tbody>{block.rows.map(row => <tr key={row.join('|')}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )
          return <button type="button" key={index} className="browser-link" onClick={() => go(block.href)}>{block.text}</button>
        })}
      </article>
    </div>
  )
}
