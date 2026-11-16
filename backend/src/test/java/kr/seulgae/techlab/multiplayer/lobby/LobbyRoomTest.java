package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import java.util.List;
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
    private final LobbyRoom room = new LobbyRoom(world, () -> 0);

    /** 수신 지연과 서버 틱 사이에서도 ack 좌표는 완료한 명령의 끝점으로 고정된다. */
    @Test void commandAckNamesCompletedMovementAndStopDoesNotDrift() {
        var player = room.join(null);
        long now = System.nanoTime() + 800_000_000L;
        assertTrue(room.commands(player.id(), List.of(new LobbyRoom.MoveCommand(1, 0, 50, 1),
            new LobbyRoom.MoveCommand(0, 1, 50, 2), new LobbyRoom.MoveCommand(0, 0, 0, 3)), now));
        var stopped = room.player(player.id());
        assertEquals(player.x() + 10, stopped.x(), 1e-8);
        assertEquals(player.y() + 10, stopped.y(), 1e-8);
        assertEquals(3, stopped.ack()); assertFalse(stopped.moving());
        room.step(0.1, now + 1_000_000_000L);
        assertEquals(stopped.x(), room.player(player.id()).x());
        assertFalse(room.commands(player.id(), List.of(new LobbyRoom.MoveCommand(1, 0, 50, 1)), now));
        assertEquals(stopped.x(), room.player(player.id()).x());
    }

    /** 시간 과장·번호 누락·잘못된 축은 원자적으로 거부하고 기존 좌표를 유지한다. */
    @Test void validatesCommandTimeSequenceAndAtomicBatch() {
        var player = room.join(null); long now = 0;
        for (var invalid : List.of(new LobbyRoom.MoveCommand(2, 0, 16, 1), new LobbyRoom.MoveCommand(1, 0, 51, 1),
            new LobbyRoom.MoveCommand(1, 0, Double.NaN, 1), new LobbyRoom.MoveCommand(1, 0, 16, 3))) {
            assertThrows(IllegalArgumentException.class, () -> room.commands(player.id(), List.of(invalid), now));
        }
        var large = java.util.stream.IntStream.rangeClosed(1, 8)
            .mapToObj(seq -> new LobbyRoom.MoveCommand(1, 0, 50, seq)).toList();
        assertTrue(room.commands(player.id(), large, now));
        assertEquals(player.x() + 50, room.player(player.id()).x(), 1e-8);
        assertEquals(5, room.player(player.id()).ack());
        // 예산이 없는 3개는 적용하거나 거부하지 않고 기다린다. 중복 수신도 재적용하지 않는다.
        assertFalse(room.commands(player.id(), large, now));
        room.step(0.05, now + 500_000_000L);
        assertEquals(player.x() + 80, room.player(player.id()).x(), 1e-8);
        var next = java.util.stream.IntStream.rangeClosed(9, 16)
            .mapToObj(seq -> new LobbyRoom.MoveCommand(1, 0, 50, seq)).toList();
        assertTrue(room.commands(player.id(), next, now + 500_000_000L));
        assertEquals(15, room.player(player.id()).ack());
        room.step(0.05, now + 550_000_000L);
        assertEquals(16, room.player(player.id()).ack());
    }

    /** 3초 분량의 정상 입력 몰림이 예산 2초를 넘겨도 기다린 뒤 같은 순서로 완료한다. */
    @Test void defersThreeSecondTransportBurstWithoutRejectingNormalInput() {
        var player = room.join(null);
        room.commands(player.id(), List.of(new LobbyRoom.MoveCommand(0, 0, 0, 1)), 0);
        for (int start = 2; start <= 181; start += 8) {
            var batch = new java.util.ArrayList<LobbyRoom.MoveCommand>();
            for (int seq = start; seq < Math.min(start + 8, 182); seq++) batch.add(new LobbyRoom.MoveCommand(1, 0, 1000d / 60, seq));
            assertTrue(room.commands(player.id(), batch, 4_000_000_000L));
        }
        assertEquals(121, room.player(player.id()).ack());
        room.step(0.05, 4_500_000_000L);
        assertEquals(151, room.player(player.id()).ack());
        room.step(0.05, 5_100_000_000L);
        assertEquals(181, room.player(player.id()).ack());
    }

    /** 지속적인 시간 과장으로 대기 한도를 넘기는 입력은 여전히 거부한다. */
    @Test void boundsDeferredMovementAndPreservesClockBasedSpeedLimit() {
        var player = room.join(null);
        for (int start = 1; start <= 33; start += 8) {
            var batch = new java.util.ArrayList<LobbyRoom.MoveCommand>();
            for (int seq = start; seq < start + 8; seq++) batch.add(new LobbyRoom.MoveCommand(1, 0, 50, seq));
            room.commands(player.id(), batch, 0);
        }
        assertEquals(5, room.player(player.id()).ack());
        assertEquals(player.x() + 50, room.player(player.id()).x(), 1e-8);
        var overflow = List.of(new LobbyRoom.MoveCommand(1, 0, 50, 41), new LobbyRoom.MoveCommand(1, 0, 50, 42),
            new LobbyRoom.MoveCommand(1, 0, 50, 43), new LobbyRoom.MoveCommand(1, 0, 50, 44),
            new LobbyRoom.MoveCommand(1, 0, 50, 45), new LobbyRoom.MoveCommand(1, 0, 50, 46));
        assertThrows(IllegalArgumentException.class, () -> room.commands(player.id(), overflow, 0));
        room.step(0.05, 50_000_000L);
        assertEquals(6, room.player(player.id()).ack());
        assertEquals(player.x() + 60, room.player(player.id()).x(), 1e-8);
    }

    /** 수신 콜백이 늦게 잠금을 얻어도 오래된 시각으로 시간 예산을 중복 충전하지 않는다. */
    @Test void keepsBudgetClockMonotonicAcrossDelayedCallbacks() {
        var player = room.join(null);
        var initial = java.util.stream.IntStream.rangeClosed(1, 6)
            .mapToObj(seq -> new LobbyRoom.MoveCommand(1, 0, 50, seq)).toList();
        room.commands(player.id(), initial, 0);
        assertEquals(5, room.player(player.id()).ack());
        room.step(0.05, 50_000_000L);
        assertEquals(6, room.player(player.id()).ack());
        room.commands(player.id(), List.of(new LobbyRoom.MoveCommand(1, 0, 50, 7)), 25_000_000L);
        room.step(0.05, 75_000_000L);
        assertEquals(6, room.player(player.id()).ack());
        room.step(0.05, 100_000_000L);
        assertEquals(7, room.player(player.id()).ack());
    }

    /** 짧은 스텝을 재생해도 대각선 속도와 책상 충돌 규칙을 유지한다. */
    @Test void commandReplayPreservesDiagonalSpeedAndCollisions() {
        var player = room.join(null); long now = System.nanoTime();
        room.commands(player.id(), List.of(new LobbyRoom.MoveCommand(1, 1, 50, 1)), now);
        var position = room.player(player.id());
        assertEquals(10, Math.hypot(position.x() - player.x(), position.y() - player.y()), 1e-8);
        for (int seq = 2; seq <= 50; seq++) {
            room.commands(player.id(), List.of(new LobbyRoom.MoveCommand(0, -1, 50, seq)), now + seq * 50_000_000L);
        }
        assertEquals(238, room.player(player.id()).y(), 1e-8);
    }

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
