import { useEffect, useRef, useState } from 'react'
import { ROOMS, roomObjects } from '../../game/maps/rooms'
import { CCTV_ROOMS } from '../../game/rooms/cctvLayout'
import type MultiplayerClient from '../multiplayer/MultiplayerClient'
import type { RoomFeeds } from '../multiplayer/model/protocol'
import '../research/components/ResearchPanel.css'
import './cctv.css'

/** client는 렌더 중 ref를 읽지 않도록 함수로 받는다. */
type Props = { client: () => MultiplayerClient | null; onClose: () => void }

/**
 * 관제실 콘솔에서 여는 CCTV 패널. 여섯 방의 평면도에 연구원 위치와 이름을 실시간(약 5Hz)으로 표시한다.
 * 서버는 관제실에 있는 참가자에게만 방별 목록을 보내므로, 관제실을 떠나면 화면이 멈춘다.
 *
 * @author seulgae
 * @version 1.0, 관제실 CCTV
 * @see "None"
 * @param props 멀티플레이 클라이언트와 닫기 콜백
 * @returns CCTV 모달
 */
export default function CctvPanel({ client, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [feeds, setFeeds] = useState<RoomFeeds | null>(() => client()?.latestFeeds() ?? null)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  useEffect(() => client()?.subscribe({ feeds: setFeeds, snapshot: (_players, id) => setSelfId(id) }), [client])
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const total = feeds ? Object.values(feeds).reduce((sum, list) => sum + (list?.length ?? 0), 0) : 0
  return (
    <dialog ref={dialogRef} className="research-panel cctv-panel" aria-labelledby="cctv-title"
      onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="research-panel-header">
        <div>
          <p className="research-eyebrow">SEULGAE TECH LAB / CONTROL ROOM</p>
          <h2 id="cctv-title">CCTV 관제</h2>
          <p className="cctv-summary"><span className="cctv-rec">● REC</span> {time.toTimeString().slice(0, 8)} · 전체 {feeds ? `${total}명` : '신호 대기 중'}</p>
        </div>
        <button type="button" className="research-close" onClick={onClose} autoFocus>닫기</button>
      </header>
      <div className="cctv-grid">
        {CCTV_ROOMS.map((roomId, index) => {
          const players = feeds?.[roomId] ?? []
          return (
            <figure className="cctv-feed" key={roomId}>
              <svg viewBox="0 0 800 600" role="img" aria-label={`${ROOMS[roomId].name} ${players.length}명`}>
                <rect x="0" y="0" width="800" height="600" className="cctv-floor" />
                <rect x="24" y="64" width="752" height="512" className="cctv-room" />
                {roomObjects(roomId).map((object, i) => (
                  <rect key={i} x={object.body.x - object.body.width / 2} y={object.body.y - object.body.height / 2}
                    width={object.body.width} height={object.body.height} className={`cctv-object cctv-${object.texture}`} />
                ))}
                {ROOMS[roomId].doors.map(door => <rect key={door.id} x={door.x - 36} y={door.y - 12} width="72" height="12" className="cctv-door" />)}
                {players.map(player => (
                  <g key={player.id} className={player.id === selfId ? 'cctv-player cctv-self' : 'cctv-player'}>
                    <circle cx={player.x} cy={player.y - 8} r="14" />
                    <text x={player.x} y={player.y - 30}>{player.nickname}</text>
                  </g>
                ))}
                {!feeds && <text x="400" y="320" className="cctv-nosignal">NO SIGNAL</text>}
              </svg>
              <figcaption><span>CAM-0{index + 1} · {ROOMS[roomId].name}</span><strong>{players.length}명</strong></figcaption>
            </figure>
          )
        })}
      </div>
      <p className="research-footer">관제실에 있는 동안만 화면이 갱신돼요. 주황 점이 나, 청록 점이 다른 연구원이에요. ESC로 닫아요.</p>
    </dialog>
  )
}
