import type { ConnectionInfo } from '../model/protocol'
import './MultiplayerStatus.css'

/**
 * 접속 인원과 임시 이름, 재연결 안내를 표시하는 로비 상태 영역이다.
 *
 * @author seulgae
 * @version 1.0, 멀티플레이 연결 상태와 오프라인 안내
 * @see "None"
 * @param props 현재 연결 상태
 * @returns 읽기 전용 접속 상태 영역
 */
export default function MultiplayerStatus({ connection }: { connection: ConnectionInfo }) {
  return (
    <div className={`multiplayer-status ${connection.phase}`} role="status" aria-live="polite">
      <span className="connection-indicator" aria-hidden="true" />
      <span>{connection.phase === 'online' ? `온라인 ${connection.online}/${connection.maxPlayers}` : connection.message}</span>
      {connection.phase === 'online' && <span className="my-nickname">나: {connection.nickname}</span>}
    </div>
  )
}
