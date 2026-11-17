package kr.seulgae.techlab.multiplayer.lobby;

import java.util.Properties;
import java.util.concurrent.atomic.AtomicLong;
import kr.seulgae.techlab.lab.status.LabStatusController;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.boot.info.BuildProperties;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 방별 상호작용 지점, 회의 테이블 대화 범위와 상태·빌드 API 집계를 검증한다.
 * @author seulgae
 * @version 1.0, 방별 상호작용 회귀 검증
 * @see "None"
 */
class RoomInteractionTest {
    private final AtomicLong clock = new AtomicLong(1_000_000_000L);
    private final LobbyWorld world = new LobbyWorld();
    private final LobbyRoom room = new LobbyRoom(world, clock::get);
    private final LobbyChat chat = new LobbyChat(room);
    private long sequence;

    /** 세로 먼저, 다음 가로로 실제 서버 이동만 사용해 목표 지점에 접근한다. */
    private void walk(String id, double x, double y) {
        for (int step = 0; step < 200; step++) {
            var p = room.player(id);
            if (Math.abs(p.x() - x) < 5 && Math.abs(p.y() - y) < 5) return;
            int dy = Math.abs(p.y() - y) < 5 ? 0 : p.y() < y ? 1 : -1;
            int dx = dy == 0 && Math.abs(p.x() - x) >= 5 ? p.x() < x ? 1 : -1 : 0;
            long now = clock.addAndGet(50_000_000L);
            assertTrue(room.input(id, dx, dy, ++sequence, now));
            room.step(.05, now);
        }
        fail("목표 접근 실패: " + room.player(id));
    }

    private void enterMeetingRoom(String id) {
        walk(id, 730, 530);
        room.changeRoom(id, "lobby-to-meeting", clock.get());
        sequence = 0;
        clock.addAndGet(1_100_000_000L);
    }

    /** 관제실만 모든 방을 볼 수 있고, 방별 목록은 빈 방까지 맵 순서대로 담는다. */
    @Test void controlRoomSeesEveryRoomByName() {
        var watcher = room.join("관제원");
        var guest = room.join("손님");
        walk(watcher.id(), 730, 260);
        room.changeRoom(watcher.id(), "lobby-to-control", clock.get());
        sequence = 0;
        assertTrue(room.monitorsAllRooms("control-room"));
        assertFalse(room.monitorsAllRooms("lobby"));
        assertFalse(room.monitorsAllRooms("outdoor"));
        var feeds = room.snapshotsByRoom();
        assertEquals(world.roomIds(), java.util.List.copyOf(feeds.keySet()));
        assertEquals("손님", feeds.get("lobby").get(0).nickname());
        assertEquals("관제원", feeds.get("control-room").get(0).nickname());
        assertTrue(feeds.get("outdoor").isEmpty());
        assertEquals(guest.id(), feeds.get("lobby").get(0).id());
    }

    @Test void everyRoomHasInteractionsOutsideSpawnAndOnlyKnownKinds() {
        var kinds = java.util.Set.of("research", "guestbook", "build-info", "server-status", "table-talk", "agenda", "cctv", "fishing", "work-board", "arcade");
        for (var roomId : world.roomIds()) {
            var interactions = world.interactions(roomId);
            assertFalse(interactions.isEmpty(), roomId);
            var spawn = world.roomSpawn(roomId);
            for (var interaction : interactions) {
                assertTrue(kinds.contains(interaction.kind()), interaction.id());
                assertFalse(interaction.near(spawn.x(), spawn.y()), "스폰에서 바로 상호작용하면 안 된다: " + interaction.id());
            }
        }
        assertTrue(world.near("meeting-room", "table-talk", 350, 340));
        assertFalse(world.near("lobby", "table-talk", 350, 340));
    }

    @Test void tableTalkRequiresServerPositionAndIsNotStoredInHistory() {
        var near = room.join("가까움");
        var far = room.join("멀리");
        enterMeetingRoom(near.id());
        enterMeetingRoom(far.id());
        assertEquals("not_at_table", assertThrows(LobbyChat.Rejected.class, () -> chat.post(near.id(), "안녕", clock.get(), true)).getMessage());

        // 세로 테이블 아래 끝(y 400) 바로 앞
        walk(near.id(), 400, 420);
        assertTrue(room.near(near.id(), LobbyChat.TABLE_KIND));
        clock.addAndGet(2_000_000_000L);
        var message = chat.post(near.id(), "테이블에서만", clock.get(), true);
        assertTrue(message.table());
        assertEquals("table", message.scope());
        assertEquals(java.util.Set.of(near.id()), room.playersNear("meeting-room", LobbyChat.TABLE_KIND));
        assertTrue(chat.history("meeting-room").isEmpty());

        var normal = chat.post(near.id(), "모두에게", clock.addAndGet(2_000_000_000L));
        assertEquals("room", normal.scope());
        assertEquals(1, chat.history("meeting-room").size());
    }

    @Test void statusAggregatesRoomCountsAndBuildHidesUntrustedCommit() {
        var first = room.join(null);
        room.join(null);
        enterMeetingRoom(first.id());
        var noBuild = new StaticListableBeanFactory().getBeanProvider(BuildProperties.class);
        var controller = new LabStatusController(room, world, noBuild, "0123456789abcdef");
        var status = controller.status().getBody();
        assertNotNull(status);
        assertEquals(2, status.onlinePlayers());
        assertEquals(world.roomIds().size(), status.rooms().size());
        assertEquals(1, status.rooms().stream().filter(r -> r.id().equals("meeting-room")).findFirst().orElseThrow().players());
        assertEquals("회의실", status.rooms().stream().filter(r -> r.id().equals("meeting-room")).findFirst().orElseThrow().name());
        assertTrue(status.memory().maxMb() > 0);
        assertEquals("0123456", controller.build().commit());
        assertEquals("dev", controller.build().version());

        var factory = new StaticListableBeanFactory();
        var properties = new Properties();
        properties.setProperty("version", "0.0.1-SNAPSHOT");
        factory.addBean("build", new BuildProperties(properties));
        var unsafe = new LabStatusController(room, world, factory.getBeanProvider(BuildProperties.class), "$(rm -rf)");
        assertEquals("local", unsafe.build().commit());
        assertEquals("0.0.1-SNAPSHOT", unsafe.build().version());
    }
}
