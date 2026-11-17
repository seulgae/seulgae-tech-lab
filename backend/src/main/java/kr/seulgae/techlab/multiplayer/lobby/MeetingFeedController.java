package kr.seulgae.techlab.multiplayer.lobby;

import java.util.List;
import java.util.Map;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관제실 CCTV용 방별 참가자 목록. 멀티플레이는 회의실에서만 열리므로 회의실 외의 방은 늘 비어 있다.
 * 관제실은 소켓 없이 혼자 둘러보는 방이라 이 목록을 2초마다 읽는다.
 *
 * @author seulgae
 * @version 1.0, 회의실 전용 멀티플레이
 * @see "None"
 */
@RestController
public class MeetingFeedController {
    private final LobbyRoom room;

    public MeetingFeedController(LobbyRoom room) { this.room = room; }

    @GetMapping("/api/lobby/feeds")
    public Map<String, List<LobbyRoom.PlayerView>> feeds() { return room.snapshotsByRoom(); }
}
