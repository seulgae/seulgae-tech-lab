import type { ConnectionInfo } from '../model/protocol'
import './MultiplayerStatus.css'
import { ROOMS } from '../../../game/maps/rooms'

/**
 * 접속 인원과 임시 이름, 재연결 안내를 표시하는 로비 상태 영역이다.
 *
 * @author seulgae
 * @version 1.0, 현재 공간·방별 인원·전체 접속 및 전환 오류 안내
 * @see "None"
 * @param props 현재 연결 상태
 * @returns 읽기 전용 접속 상태 영역
 */
export default function MultiplayerStatus({ connection }: { connection: ConnectionInfo }) {
  return (
    <div className={`multiplayer-status ${connection.phase}`} role="status" aria-live="polite">
      <span className="connection-indicator" aria-hidden="true" />
      <span>{connection.phase === 'online' ? `${ROOMS[connection.roomId ?? 'lobby'].name} · 현재 방 ${connection.roomOnline ?? connection.online}명 / 전체 ${connection.totalOnline ?? connection.online}명` : connection.message}</span>
      {connection.roomError && <span>{connection.roomError}</span>}
      {connection.travelling && <span>방 이동 승인 대기 중…</span>}
      {connection.phase === 'online' && <span className="my-nickname">나: {connection.nickname}</span>}
    </div>
  )
}
