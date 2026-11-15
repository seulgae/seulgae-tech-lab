package kr.seulgae.techlab.multiplayer.lobby;

import java.time.Instant;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 일반 텍스트·발신자·채팅 예산·최근 기록의 경계를 검증한다.
 * @author seulgae
 * @version 1.0, 채팅 도메인 회귀 검증
 * @see "None"
 */
class LobbyChatTest {
    private final LobbyRoom room = new LobbyRoom(new LobbyWorld());
    private final LobbyChat chat = new LobbyChat(room);

    @Test void assignsIdentityTimeAndKeepsMarkupAsPlainText() {
        var player = room.join("연구원");
        var message = chat.post(player.id(), "  <script>alert('x')</script>\r\n안녕 👋  ", 1);
        assertEquals(player.id(), message.playerId());
        assertEquals(player.nickname(), message.nickname());
        assertEquals("<script>alert('x')</script>\n안녕 👋", message.message());
        assertNotNull(Instant.parse(message.sentAt()));
        assertNotNull(java.util.UUID.fromString(message.messageId()));
        room.leave(player.id()); chat.leave(player.id());
        assertEquals("unavailable", assertThrows(LobbyChat.Rejected.class, () -> chat.post(player.id(), "퇴장", 2)).getMessage());
    }

    @Test void validatesUnicodeLengthBlankAndControls() {
        var player = room.join(null);
        String[] invalid = {"", " \t\n\u00a0 ", "\uFEFF", "가".repeat(151), "\u0000", "\ud800"};
        long now = 1;
        for (String value : invalid) {
            final long time = now;
            assertThrows(LobbyChat.Rejected.class, () -> chat.post(player.id(), value, time));
            now += 1_000_000_000L;
        }
        assertEquals("👋".repeat(150), chat.post(player.id(), "👋".repeat(150), now).message());
    }

    @Test void rateLimitsChatWithoutConsumingOrChangingMovementAck() {
        var player = room.join(null);
        assertTrue(room.input(player.id(), 1, 0, 5, 1));
        for (int i = 0; i < 3; i++) chat.post(player.id(), "메시지 " + i, 1);
        assertEquals("rate_limited", assertThrows(LobbyChat.Rejected.class, () -> chat.post(player.id(), "도배", 1)).getMessage());
        assertEquals(5, room.player(player.id()).ack());
        assertTrue(room.input(player.id(), 0, 0, 6, 2));
        assertNotNull(chat.post(player.id(), "회복", 1_000_000_001L));
    }

    @Test void storesOnlyLastFiftyMessagesAndNewServerStartsEmpty() {
        var player = room.join(null);
        for (int i = 0; i < 60; i++) chat.post(player.id(), "기록 " + i, i * 1_000_000_000L);
        assertEquals(50, chat.history().size());
        assertEquals("기록 10", chat.history().get(0).message());
        assertEquals("기록 59", chat.history().get(49).message());
        assertThrows(UnsupportedOperationException.class, () -> chat.history().clear());
        assertTrue(new LobbyChat(room).history().isEmpty());
    }
}
