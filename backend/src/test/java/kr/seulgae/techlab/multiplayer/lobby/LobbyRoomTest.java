package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 서버 기준 속도·입력 제한·충돌 및 세션 수명 규칙을 검증한다.
 *
 * @author seulgae
 * @version 1.0, 로비 도메인 회귀 검증
 * @see "None"
 */
class LobbyRoomTest {
    private final LobbyWorld world = new LobbyWorld();
    private final LobbyRoom room = new LobbyRoom(world);

    /** 중복 닉네임의 접미사를 붙일 때 보조 평면 문자의 UTF-16 쌍을 자르지 않는다. */
    @Test void preservesUnicodeCodePointsWhenDisambiguatingNickname() {
        String name = "\ud801\udc00".repeat(16);
        var first = room.join(name);
        var second = room.join(name);
        assertNotEquals(first.nickname(), second.nickname());
        assertEquals(16, second.nickname().codePointCount(0, second.nickname().length()));
        assertTrue(second.nickname().matches("[\\p{L}\\p{N}_-]{1,16}"));
    }

    @Test void validatesNamesCapacityAndUniqueIdentities() {
        var first = room.join("연구원");
        var second = room.join("연구원");
        assertNotEquals(first.id(), second.id());
        assertNotEquals(first.nickname(), second.nickname());
        assertThrows(IllegalArgumentException.class, () -> room.join("<script>"));
        for (int i = 0; i < 3; i++) room.join(null);
        assertThrows(IllegalStateException.class, () -> room.join(null));
        room.leave(first.id());
        assertNotNull(room.join(null));
    }

    @Test void enforcesSpeedDiagonalNormalizationAndInputExpiry() {
        var player = room.join(null);
        long now = 1_000_000_000L;
        assertTrue(room.input(player.id(), 1, 1, 1, now));
        room.step(0.05, now + 50_000_000L);
        var moved = room.snapshot().get(0);
        assertEquals(10, Math.hypot(moved.x() - player.x(), moved.y() - player.y()), 0.00001);
        assertEquals("down", moved.facing());
        assertTrue(moved.moving());
        room.step(0.05, now + 400_000_000L);
        assertEquals(moved.x(), room.snapshot().get(0).x());
        assertFalse(room.snapshot().get(0).moving());
    }

    @Test void rejectsTeleportStyleAxesAndReplayedInputs() {
        var player = room.join(null);
        assertFalse(room.input(player.id(), 10000, 0, 1, 1));
        assertFalse(room.input(player.id(), Integer.MIN_VALUE, 0, 1, 1));
        assertFalse(room.input(player.id(), 1, 0, -1, 1));
        assertTrue(room.input(player.id(), 1, 0, 1, 1));
        assertFalse(room.input(player.id(), 1, 0, 1, 1));
        assertFalse(room.input(player.id(), 1, 0, Long.MAX_VALUE, 1));
    }

    @Test void clipsWallsDeskComputerAndSlidingInsteadOfTrustingCoordinates() {
        assertEquals(238, world.move(400, 400, 0, -1000).y());
        assertEquals(382, world.move(620, 400, 0, -1000).y());
        assertEquals(34, world.move(400, 80, -1000, 0).x());
        assertEquals(766, world.move(400, 80, 1000, 0).x());
        assertEquals(80, world.move(400, 100, 0, -1000).y());
        assertEquals(576, world.move(400, 500, 0, 1000).y());
        var sliding = world.move(400, 238, 10, -10);
        assertEquals(410, sliding.x());
        assertEquals(238, sliding.y());
    }
}
