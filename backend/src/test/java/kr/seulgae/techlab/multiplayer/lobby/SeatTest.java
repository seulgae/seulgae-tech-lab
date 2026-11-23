package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.multiplayer.lobby.domain.*;
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

    /** 관리자실은 개발 연구실 오른쪽 위 문이다: 로비 → 개발 연구실 → (작업대를 피해 오른쪽으로 돌아) 관리자실 */
    private void enterAdminRoom(String id) {
        walk(id, 70, 260);
        room.changeRoom(id, "lobby-to-development", clock.get());
        sequence = 0;
        walk(id, 730, 460);
        walk(id, 730, 260);
        room.changeRoom(id, "development-to-control", clock.get());
        sequence = 0;
    }

    /** 구형 입력은 마지막 방향을 300ms 유지하므로, 도착하면 정지 입력을 보낸다. */
    private void stop(String id) {
        long now = clock.addAndGet(50_000_000L);
        assertTrue(room.input(id, 0, 0, ++sequence, now));
        room.step(.05, now);
    }

    @Test void everyRoomExposesItsChairsAsSeats() {
        assertTrue(world.seats("lobby").isEmpty(), "로비 의자는 모두 치웠다");
        assertEquals(List.of("control-room-chair-0", "control-room-chair-1"), world.seats("control-room").stream().map(LobbyWorld.Seat::id).toList());
        assertEquals(6, world.seats("meeting-room").size(), "세로 테이블 양옆 3개씩");
        assertTrue(world.seats("development-lab").isEmpty(), "개발 연구실 슈퍼컴퓨터 앞 의자는 치웠다");
        assertTrue(world.seats("server-room").isEmpty());
    }

    @Test void sitsOnlyNearAFreeChairAndStandsWhenMoving() {
        var a = room.join("앉는사람");
        var b = room.join("다른사람");
        // 관리자실 의자 0: (340, 358) 28x24. 개발 연구실 오른쪽 위 문으로 들어가 의자 아래쪽에 서면 가깝다.
        for (var id : List.of(a.id(), b.id())) enterAdminRoom(id);
        assertFalse(room.sit(a.id(), "control-room-chair-0"), "멀리서는 앉을 수 없다");
        walk(a.id(), 340, 395);
        stop(a.id());
        assertTrue(room.sit(a.id(), "control-room-chair-0"));
        assertEquals("control-room-chair-0", room.player(a.id()).seat());
        assertFalse(room.sit(a.id(), "meeting-room-chair-0"), "다른 방 의자는 안 된다");

        walk(b.id(), 350, 395);
        stop(b.id());
        assertEquals("control-room-chair-0", room.player(a.id()).seat(), "다른 사람이 걸어도 앉은 사람은 그대로다");
        assertFalse(room.sit(b.id(), "control-room-chair-0"), "이미 앉은 자리는 안 된다");

        long now = clock.addAndGet(50_000_000L);
        assertTrue(room.input(a.id(), 0, 1, ++sequence, now));
        room.step(.05, now);
        assertNull(room.player(a.id()).seat(), "움직이면 일어난다");
        assertTrue(room.sit(b.id(), "control-room-chair-0"));
        assertTrue(room.sit(b.id(), null));
        assertNull(room.player(b.id()).seat());
    }

    /**
     * 운영 버그(일지 #5): 걷다가 바로 E를 누르면, 앉기 요청보다 먼저 보낸 걸음이 서버에서 늦게 처리되며 일으켜 세웠다.
     * 앉기 전에 보낸 걸음은 일으키지 않고, 그 걸음을 마친 뒤 앉는다. 앉은 뒤에 보낸 걸음만 일으킨다.
     */
    @Test void stepsSentBeforeSittingDoNotStandThePlayerUp() {
        var a = room.join("앉는사람");
        enterAdminRoom(a.id());
        walk(a.id(), 340, 395);
        stop(a.id());
        long now = clock.get();
        long seq = room.player(a.id()).ack();
        // 같은 시각에 좌우로 오가는 걸음 32개(1.6초)를 보내 일부가 서버 대기열에 남게 한다.
        for (int batch = 0; batch < 4; batch++) {
            var commands = new java.util.ArrayList<LobbyRoom.MoveCommand>();
            for (int i = 0; i < 8; i++) commands.add(new LobbyRoom.MoveCommand(i % 2 == 0 ? 1 : -1, 0, 50, ++seq));
            assertTrue(room.commands(a.id(), commands, now));
        }
        assertTrue(room.sit(a.id(), "control-room-chair-0"), "앉기 요청은 받아 둔다");
        for (int i = 0; i < 40; i++) room.step(.05, clock.addAndGet(50_000_000L));
        assertEquals("control-room-chair-0", room.player(a.id()).seat(), "앉기 전 걸음을 마친 뒤 앉아 있다");
        assertTrue(room.commands(a.id(), List.of(new LobbyRoom.MoveCommand(0, 1, 50, ++seq)), clock.addAndGet(50_000_000L)));
        assertNull(room.player(a.id()).seat(), "앉은 뒤에 보낸 걸음은 일으킨다");
    }
}
