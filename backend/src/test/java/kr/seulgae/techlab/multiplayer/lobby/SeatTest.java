package kr.seulgae.techlab.multiplayer.lobby;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 의자 앉기: 공유 맵 의자 목록, 거리 검증, 자리 중복 방지, 이동·방 이동 시 자동 일어남을 검증한다.
 * @author seulgae
 * @version 1.0, 의자 상호작용
 * @see "None"
 */
class SeatTest {
    private final AtomicLong clock = new AtomicLong(1_000_000_000L);
    private final LobbyWorld world = new LobbyWorld();
    private final LobbyRoom room = new LobbyRoom(world, clock::get);
    private long sequence;

    private void walk(String id, double x, double y) {
        for (int step = 0; step < 200; step++) {
            var p = room.player(id);
            if (Math.abs(p.x() - x) < 6 && Math.abs(p.y() - y) < 6) return;
            int dy = Math.abs(p.y() - y) < 6 ? 0 : p.y() < y ? 1 : -1;
            int dx = dy == 0 && Math.abs(p.x() - x) >= 6 ? p.x() < x ? 1 : -1 : 0;
            long now = clock.addAndGet(50_000_000L);
            assertTrue(room.input(id, dx, dy, ++sequence, now));
            room.step(.05, now);
        }
        fail("목표 접근 실패: " + room.player(id));
    }

    /** 구형 입력은 마지막 방향을 300ms 유지하므로, 도착하면 정지 입력을 보낸다. */
    private void stop(String id) {
        long now = clock.addAndGet(50_000_000L);
        assertTrue(room.input(id, 0, 0, ++sequence, now));
        room.step(.05, now);
    }

    @Test void everyRoomExposesItsChairsAsSeats() {
        assertEquals(List.of("lobby-chair-0", "lobby-chair-1"), world.seats("lobby").stream().map(LobbyWorld.Seat::id).toList());
        assertEquals(3, world.seats("meeting-room").size());
        assertEquals(2, world.seats("development-lab").size());
        assertTrue(world.seats("server-room").isEmpty());
    }

    @Test void sitsOnlyNearAFreeChairAndStandsWhenMoving() {
        var a = room.join("앉는사람");
        var b = room.join("다른사람");
        // 로비 의자 0: (620, 418) 28x24. 의자 아래쪽에 서면 가깝다.
        assertFalse(room.sit(a.id(), "lobby-chair-0"), "멀리서는 앉을 수 없다");
        walk(a.id(), 620, 460);
        stop(a.id());
        assertTrue(room.sit(a.id(), "lobby-chair-0"));
        assertEquals("lobby-chair-0", room.player(a.id()).seat());
        assertFalse(room.sit(a.id(), "meeting-room-chair-0"), "다른 방 의자는 안 된다");

        walk(b.id(), 600, 470);
        stop(b.id());
        assertEquals("lobby-chair-0", room.player(a.id()).seat(), "다른 사람이 걸어도 앉은 사람은 그대로다");
        assertFalse(room.sit(b.id(), "lobby-chair-0"), "이미 앉은 자리는 안 된다");

        long now = clock.addAndGet(50_000_000L);
        assertTrue(room.input(a.id(), 0, 1, ++sequence, now));
        room.step(.05, now);
        assertNull(room.player(a.id()).seat(), "움직이면 일어난다");
        assertTrue(room.sit(b.id(), "lobby-chair-0"));
        assertTrue(room.sit(b.id(), null));
        assertNull(room.player(b.id()).seat());
    }
}
