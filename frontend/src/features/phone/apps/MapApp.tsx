import { useState } from 'react'
import { ROOMS } from '../../../game/maps/rooms'
import type { RoomId } from '../../../game/maps/rooms'
import { ROOM_THEMES } from '../../../game/rooms/roomThemes'
import { areaOf, mapAreas } from '../mapLayout'

/**
 * 폰 지도 앱: 연구소를 구역(로비·개발 연구실)별로 보여 주고 지금 있는 방에 "현재 위치"를 찍는다.
 * 방을 누르면 그 방에서 할 수 있는 일을 알려 주고, 다른 구역 칸을 누르면 그 구역 지도로 넘어간다.
 *
 * @author 길태형
 * @version 1.0, 폰 지도 앱
 * @see "None"
 * @param props 지금 방
 * @returns 지도 화면
 */
export default function MapApp({ current }: { current: RoomId }) {
  const areas = mapAreas()
  const [hub, setHub] = useState<RoomId>(() => areaOf(current))
  const [picked, setPicked] = useState<RoomId>(current)
  const area = areas.find(entry => entry.hub === hub) ?? areas[0]!
  const notes = ROOM_THEMES[picked].notes

  return (
    <div className="phone-app-body">
      <div className="phone-tabs" role="tablist" aria-label="구역">
        {areas.map(entry => (
          <button key={entry.hub} type="button" role="tab" aria-selected={entry.hub === hub} onClick={() => setHub(entry.hub)}>{entry.name} 구역</button>
        ))}
      </div>

      {/* 가운데 방과 문 위치대로 놓은 둘레 방 */}
      <div className="map-grid" aria-label={`${area.name} 구역 지도`}>
        {area.cells.map(cell => (
          <button key={`${cell.slot}-${cell.room}`} type="button" className={`map-cell map-${cell.slot}${cell.room === current ? ' map-here' : ''}${cell.room === picked ? ' map-picked' : ''}`}
            onClick={() => { if (cell.hub) setHub(cell.hub); setPicked(cell.room) }}
            aria-label={`${cell.name}${cell.room === current ? ' (현재 위치)' : ''}`}>
            <span>{cell.hub ? `→ ${cell.name}` : cell.name}</span>
            {cell.room === current && <small>📍 현재 위치</small>}
          </button>
        ))}
      </div>

      <section className="phone-card map-info" aria-live="polite">
        <strong>{ROOMS[picked].name}{picked === current ? ' · 현재 위치' : ''}</strong>
        <small>{notes.missionTitle}</small>
        <p>{notes.mission}</p>
      </section>
    </div>
  )
}
