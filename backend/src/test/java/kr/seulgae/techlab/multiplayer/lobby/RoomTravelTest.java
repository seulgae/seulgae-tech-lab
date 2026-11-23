package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.multiplayer.lobby.domain.*;
import java.util.concurrent.atomic.AtomicLong;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 서버 좌표로 모든 출입구 왕복과 방별 충돌·기록 격리를 검증한다.
 * @author seulgae
 * @version 1.0, 세 연구실 왕복과 방 이동 검증
 * @see "None"
 */
class RoomTravelTest {
    private final AtomicLong clock = new AtomicLong(1_000_000_000L);
    private final LobbyWorld world = new LobbyWorld();
    private final LobbyRoom room = new LobbyRoom(world, clock::get);
    private long sequence;

    /** 축별 실제 서버 이동으로 출입구까지 이동하며 임의 좌표를 주입하지 않는다. */
    private void walk(String id, double x, double y) {
        for (int step = 0; step < 150; step++) {
            var p = room.player(id);
            if (Math.abs(p.x() - x) < 5 && Math.abs(p.y() - y) < 5) return;
            int dy = Math.abs(p.y() - y) < 5 ? 0 : p.y() < y ? 1 : -1;
            int dx = dy == 0 && Math.abs(p.x() - x) >= 5 ? p.x() < x ? 1 : -1 : 0;
            long now = clock.addAndGet(50_000_000L);
            assertTrue(room.input(id, dx, dy, ++sequence, now));
            room.step(.05, now);
        }
        fail("출입구 접근 실패: " + room.player(id));
    }

    /** 로비 다섯 문(옆문 넷, 아래 나가기)을 여러 번 왕복해 방 세대·정지·스폰을 확인한다. */
    @Test void repeatsAllLobbyDoorRoutesAndRejectsWrongDoorAndCooldown() {
        var p = room.join(null);
        // 로비 오른쪽 위는 빈 사무실(office-2), 왼쪽 아래는 오락실(office-3), 오른쪽 아래는 개인 기숙사(office-4)다. 회의실은 개발 연구실에서 들어간다.
        String[] ids = {"development", "office-2", "arcade", "office-4", "outdoor"};
        String[] targets = {"development-lab", "office-2", "office-3", "office-4", "outdoor"};
        String[] backs = {"development-to-lobby", "office-2-to-lobby", "office-3-to-lobby", "office-4-to-lobby", "outdoor-to-lobby"};
        int[] xs = {70, 730, 70, 730, 400};
        int[] ys = {260, 260, 530, 530, 530};
        for (int cycle = 0; cycle < 3; cycle++) {
            for (int i = 0; i < ids.length; i++) {
                assertThrows(IllegalArgumentException.class, () -> room.changeRoom(p.id(), "missing", clock.get()));
                walk(p.id(), xs[i], ys[i]);
                long epoch = room.epoch(p.id());
                room.changeRoom(p.id(), "lobby-to-" + ids[i], clock.get());
                sequence = 0;
                assertEquals(targets[i], room.roomId(p.id()));
                assertEquals(epoch + 1, room.epoch(p.id()));
                assertEquals(-1, room.player(p.id()).ack());
                assertFalse(room.player(p.id()).moving());
                assertEquals(world.roomSpawn(targets[i]).y(), room.player(p.id()).y());
                assertThrows(IllegalArgumentException.class, () -> room.changeRoom(p.id(), "lobby-to-development", clock.get()));
                walk(p.id(), 400, 530);
                clock.addAndGet(1_100_000_000L);
                room.changeRoom(p.id(), backs[i], clock.get());
                sequence = 0;
                assertEquals("lobby", room.roomId(p.id()));
                clock.addAndGet(1_100_000_000L);
            }
        }
        assertEquals(30, room.epoch(p.id()));
        assertEquals(1, room.snapshot().size());
    }

    /** 같은 방의 기록은 유지하고 이동 목적지 기록과 전송 예산은 분리한다. */
    @Test void keepsRoomHistoryAndGlobalSpamBudgetAcrossTravel() {
        var p = room.join(null); var chat = new LobbyChat(room);
        chat.post(p.id(), "로비 기록", clock.get());
        walk(p.id(), 70, 260);
        room.changeRoom(p.id(), "lobby-to-development", clock.get());
        chat.post(p.id(), "개발 기록", clock.get());
        assertEquals("로비 기록", chat.history("lobby").get(0).message());
        assertEquals("개발 기록", chat.history("development-lab").get(0).message());
        assertTrue(chat.history("server-room").isEmpty());
        assertEquals(0, room.snapshot("lobby").size());
        assertEquals(1, room.snapshot("development-lab").size());
    }

    /** 서버 랙은 로비와 다른 위치에서도 충돌하며 임의 출입구 거리는 거부한다. */
    @Test void roomGeometryAndDoorDistanceAreAuthoritative() {
        assertEquals(126, world.moveIn("server-room", 100, 220, 100, 0).x());
        assertThrows(IllegalArgumentException.class, () -> world.destination("lobby", "lobby-to-development", 400, 400));
        assertThrows(IllegalArgumentException.class, () -> world.destination("server-room", "lobby-to-development", 400, 540));
    }
}
