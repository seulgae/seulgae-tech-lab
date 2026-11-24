import { useEffect, useRef, useState } from 'react'
import catalogFile from '../../../../shared/usemaps.json'
import { playSfx } from '../../audio/AudioManager'
import { CHAT_MAX, ROOM_NAME_MAX, SDK_SOURCE, connectUseMap, parseFromMap, roomActions } from './usemapClient'
import type { ClientMessage, ServerMessage, ToMap, UseMapCatalogEntry, UseMapChat, UseMapPlayer, UseMapRoom, UseMapStart } from './usemapClient'
import '../../components/panel.css'
import './usemap.css'

const CATALOG = catalogFile.maps as UseMapCatalogEntry[]
const time = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

/**
 * 협동 연구실 유즈맵 대기실: 방 목록·방 만들기·입장, 대기실/방 채팅, 방 안(참가자·준비·맵 선택·시작), 게임 화면(맵 iframe).
 * 맵은 sandbox iframe에서 실행되고 SDK(postMessage)로만 플랫폼과 대화한다. 판정은 방장 브라우저의 맵이 한다.
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 * @see None
 * @param props 닫기 콜백
 * @returns 대기실 모달
 */
export default function UseMapPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const sendRef = useRef<(message: ClientMessage) => void>(() => undefined)
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [me, setMe] = useState<UseMapPlayer | null>(null)
  const [rooms, setRooms] = useState<UseMapRoom[]>([])
  const [room, setRoom] = useState<UseMapRoom | null>(null)
  const [chats, setChats] = useState<UseMapChat[]>([])
  const [chatTab, setChatTab] = useState<'lobby' | 'room'>('lobby')
  const [chatText, setChatText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', mapId: CATALOG[0]?.id ?? '', max: 4, password: '' })
  const [joinPassword, setJoinPassword] = useState<{ roomId: string; value: string } | null>(null)
  const [game, setGame] = useState<UseMapStart | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const gameRef = useRef<UseMapStart | null>(null)
  const meRef = useRef<UseMapPlayer | null>(null)

  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close() }, [])

  /* 서버 연결과 메시지 처리 */
  useEffect(() => {
    const toMap = (message: ToMap) => frameRef.current?.contentWindow?.postMessage(message, '*')
    const onMessage = (message: ServerMessage) => {
      switch (message.t) {
        case 'welcome': setMe(message.you); meRef.current = message.you; break
        case 'rooms': setRooms(message.rooms); break
        case 'room':
          setRoom(message.room)
          /* 게임 중 방장이 나가 새 방장이 되면 판을 끝낸다(판 상태는 예전 방장 브라우저에 있었다). */
          if (message.room.playing && gameRef.current && message.room.hostId !== gameRef.current.hostId && message.room.hostId === meRef.current?.id) {
            sendRef.current({ t: 'end', result: { aborted: true, reason: '방장이 나가서 게임이 끝났어요.' } })
          }
          break
        case 'left': setRoom(null); setGame(null); gameRef.current = null; setChatTab('lobby'); break
        case 'chat': setChats(list => [...list.slice(-80), message]); break
        case 'start': setResult(null); setGame(message); gameRef.current = message; playSfx('success', { volume: 0.6 }); break
        case 'game': toMap({ source: SDK_SOURCE, type: 'message', from: message.from, data: message.data }); break
        case 'end': setGame(null); gameRef.current = null; setResult(message.result); break
        case 'error': setError(message.message); playSfx('error', { volume: 0.4 }); break
      }
    }
    const connection = connectUseMap(onMessage, next => setState(next))
    sendRef.current = connection.send
    return () => connection.close()
  }, [])

  /* 맵 iframe이 보내는 메시지(SDK): 준비되면 시작 정보를 주고, 보낸 값은 서버로 중계, 끝나면 결과 보고(방장만) */
  useEffect(() => {
    const onMap = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return
      const message = parseFromMap(event.data)
      const start = gameRef.current, self = meRef.current
      if (!message || !start || !self) return
      if (message.type === 'ready') {
        frameRef.current?.contentWindow?.postMessage({ source: SDK_SOURCE, type: 'init', me: self, hostId: start.hostId, players: start.players, seed: start.seed } satisfies ToMap, '*')
      } else if (message.type === 'send') sendRef.current({ t: 'game', data: message.data })
      else if (message.type === 'end' && start.hostId === self.id) sendRef.current({ t: 'end', result: message.result })
    }
    window.addEventListener('message', onMap)
    return () => window.removeEventListener('message', onMap)
  }, [])

  const send = (message: ClientMessage) => { setError(null); sendRef.current(message) }
  const mapOf = (id: string) => CATALOG.find(entry => entry.id === id)
  const actions = room && me ? roomActions(room, me.id, mapOf(room.mapId)) : null
  const shownChats = chats.filter(chat => chat.scope === chatTab)

  const create = () => {
    if (!form.name.trim()) return
    send({ t: 'create', name: form.name, mapId: form.mapId, max: form.max, password: form.password })
    setCreating(false); setChatTab('room')
  }
  const join = (target: UseMapRoom, password = '') => { send({ t: 'join', roomId: target.id, password }); setJoinPassword(null); setChatTab('room') }
  const sendChat = () => {
    const text = chatText.trim()
    if (!text) return
    send({ t: 'chat', scope: room ? chatTab : 'lobby', text }); setChatText('')
  }

  return (
    <dialog ref={dialogRef} className={`research-panel usemap-panel${game ? ' playing' : ''}`} aria-labelledby="usemap-title" onCancel={event => { event.preventDefault(); if (!game) onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">PRACTICE LAB / USE MAP</p>
          <h2 id="usemap-title">{game ? mapOf(game.mapId)?.name ?? '유즈맵' : room ? room.name : '유즈맵 대기실'}</h2>
        </div>
        <div className="usemap-header-actions">
          <span className={`usemap-state ${state}`}>{state === 'open' ? `● 접속 중 · ${me?.nickname ?? ''}` : state === 'connecting' ? '연결 중…' : '연결 끊김'}</span>
          {room && <button type="button" className="research-close" onClick={() => send({ t: 'leave' })}>{game ? '게임 나가기' : '방 나가기'}</button>}
          {!game && <button type="button" className="research-close" onClick={onClose}>닫기</button>}
        </div>
      </header>
      {error && <p className="usemap-error" role="alert">{error}</p>}
      {state === 'closed' && <p className="usemap-error">대기실 서버와 연결이 끊겼어요. 창을 닫았다 다시 열어 주세요.</p>}

      {game ? (
        /* 게임 화면: 맵은 sandbox iframe에서 실행(쿠키·우리 화면에 접근 불가) */
        <iframe ref={frameRef} className="usemap-frame" title={mapOf(game.mapId)?.name ?? '유즈맵'} src={mapOf(game.mapId)?.entry} sandbox="allow-scripts" />
      ) : (
        <div className="usemap-body">
          <section className="usemap-main">
            {!room ? (
              <>
                <div className="usemap-toolbar">
                  <h3>방 목록 <span>{rooms.length}</span></h3>
                  <button type="button" className="usemap-primary" onClick={() => setCreating(value => !value)} disabled={state !== 'open'}>{creating ? '취소' : '+ 방 만들기'}</button>
                </div>
                {creating && (
                  <form className="usemap-form" onSubmit={event => { event.preventDefault(); create() }}>
                    <label>방 이름<input maxLength={ROOM_NAME_MAX} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required autoFocus /></label>
                    <label>맵<select value={form.mapId} onChange={event => setForm({ ...form, mapId: event.target.value })}>{CATALOG.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
                    <label>최대 인원<select value={form.max} onChange={event => setForm({ ...form, max: Number(event.target.value) })}>{[2, 3, 4, 5, 6, 7, 8].filter(n => n <= (mapOf(form.mapId)?.maxPlayers ?? 8)).map(n => <option key={n} value={n}>{n}명</option>)}</select></label>
                    <label>비밀번호(선택)<input maxLength={20} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
                    <button type="submit" className="usemap-primary" disabled={!form.name.trim()}>만들기</button>
                  </form>
                )}
                {rooms.length === 0 && <p className="usemap-empty">열린 방이 없어요. 첫 방을 만들어 보세요!</p>}
                <ul className="usemap-rooms">
                  {rooms.map(item => (
                    <li key={item.id} className={item.playing ? 'playing' : ''}>
                      <div>
                        <strong>{item.locked ? '🔒 ' : ''}{item.name}</strong>
                        <small>{mapOf(item.mapId)?.name ?? item.mapId} · {item.players.length}/{item.maxPlayers}명 · {item.playing ? '게임 중' : '대기 중'}</small>
                      </div>
                      {joinPassword?.roomId === item.id ? (
                        <form className="usemap-inline" onSubmit={event => { event.preventDefault(); join(item, joinPassword.value) }}>
                          <input aria-label="비밀번호" placeholder="비밀번호" value={joinPassword.value} onChange={event => setJoinPassword({ roomId: item.id, value: event.target.value })} autoFocus />
                          <button type="submit">입장</button>
                        </form>
                      ) : (
                        <button type="button" disabled={item.playing || item.players.length >= item.maxPlayers || state !== 'open'}
                          onClick={() => item.locked ? setJoinPassword({ roomId: item.id, value: '' }) : join(item)}>입장하기</button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                {/* 방 안: 맵(방장이 바꿈), 참가자와 준비, 시작 */}
                <div className="usemap-map">
                  <div>
                    <small>맵</small>
                    {actions?.host ? (
                      <select value={room.mapId} onChange={event => send({ t: 'map', mapId: event.target.value })}>{CATALOG.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}</select>
                    ) : <strong>{mapOf(room.mapId)?.name ?? room.mapId}</strong>}
                    <p>{mapOf(room.mapId)?.description}</p>
                  </div>
                </div>
                <h3>참가자 <span>{room.players.length}/{room.maxPlayers}</span></h3>
                <ul className="usemap-players">
                  {room.players.map(player => (
                    <li key={player.id}>
                      <span>{player.id === room.hostId ? '👑 ' : ''}{player.nickname}{player.id === me?.id ? ' (나)' : ''}</span>
                      <small>{player.id === room.hostId ? '방장' : room.ready.includes(player.id) ? '✔ 준비' : '대기'}</small>
                    </li>
                  ))}
                </ul>
                {result && <p className="usemap-result">{typeof result.reason === 'string' ? result.reason : result.win === true ? '🎉 승리!' : result.win === false ? '패배… 다시 도전!' : '게임이 끝났어요.'}{typeof result.score === 'number' ? ` 점수 ${result.score}` : ''}</p>}
                <div className="usemap-actions">
                  {actions?.host
                    ? <button type="button" className="usemap-primary" disabled={!actions.canStart} onClick={() => send({ t: 'start' })}>▶ 게임 시작</button>
                    : <button type="button" className="usemap-primary" onClick={() => send({ t: 'ready', ready: !actions?.ready })}>{actions?.ready ? '준비 취소' : '준비'}</button>}
                  {actions?.waitingFor && <small>{actions.waitingFor}</small>}
                </div>
              </>
            )}
          </section>

          {/* 채팅: 대기실 전체 / 방 */}
          <section className="usemap-chat" aria-label="채팅">
            <div className="usemap-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={chatTab === 'lobby'} onClick={() => setChatTab('lobby')}>대기실</button>
              <button type="button" role="tab" aria-selected={chatTab === 'room'} disabled={!room} onClick={() => setChatTab('room')}>방</button>
            </div>
            <ol className="usemap-messages" aria-live="polite">
              {shownChats.length === 0 && <li className="usemap-empty">아직 대화가 없어요.</li>}
              {shownChats.map((chat, index) => <li key={`${chat.at}-${index}`}><strong>{chat.from}</strong> {chat.text} <small>{time(chat.at)}</small></li>)}
            </ol>
            <form className="usemap-inline" onSubmit={event => { event.preventDefault(); sendChat() }}>
              <input aria-label="대화 입력" maxLength={CHAT_MAX} value={chatText} placeholder={chatTab === 'room' ? '방에 말하기' : '대기실에 말하기'} onChange={event => setChatText(event.target.value)} disabled={state !== 'open'} />
              <button type="submit" disabled={!chatText.trim() || state !== 'open'}>보내기</button>
            </form>
          </section>
        </div>
      )}
      <p className="research-footer">{game ? '게임 중에는 ESC로 닫히지 않아요. 위 "게임 나가기"로 나가요.' : '방을 만들거나 들어가서, 방장이 맵을 고르고 시작해요. ESC로 닫아요.'}</p>
    </dialog>
  )
}
