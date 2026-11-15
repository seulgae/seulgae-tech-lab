package kr.seulgae.techlab.multiplayer.lobby;

import java.net.URI;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import kr.seulgae.techlab.multiplayer.lobby.websocket.LobbySocketHandler;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 상태 송신과 정책 위반 종료가 겹쳐도 종료 프레임이 순서대로 전달되는지 검증한다.
 *
 * @author seulgae
 * @version 1.0, 송신 중 연결 종료 경쟁 조건 회귀 검증
 * @see "None"
 */
class LobbySocketCloseTest {
    /** 느린 송신 도중 잘못된 입력을 받아도 close와 send가 동시에 실행되지 않아야 한다. */
    @Test void sendsPolicyCloseOnlyAfterInFlightMessageCompletes() throws Exception {
        var room = new LobbyRoom(new LobbyWorld());
        var handler = new LobbySocketHandler(room);
        var session = mock(WebSocketSession.class);
        var open = new AtomicBoolean(true);
        var blockWrites = new AtomicBoolean(false);
        var writing = new AtomicBoolean(false);
        var overlap = new AtomicBoolean(false);
        var writeStarted = new CountDownLatch(1);
        var releaseWrite = new CountDownLatch(1);
        var closed = new CountDownLatch(1);
        when(session.getId()).thenReturn("close-race");
        when(session.getUri()).thenReturn(URI.create("ws://localhost/ws/lobby"));
        when(session.isOpen()).thenAnswer(invocation -> open.get());
        doAnswer(invocation -> {
            if (blockWrites.get()) {
                writing.set(true);
                writeStarted.countDown();
                try {
                    if (!releaseWrite.await(3, TimeUnit.SECONDS)) throw new AssertionError("송신 해제 대기 초과");
                } finally { writing.set(false); }
            }
            return null;
        }).when(session).sendMessage(any());
        doAnswer(invocation -> {
            overlap.set(writing.get());
            open.set(false);
            closed.countDown();
            return null;
        }).when(session).close(any(CloseStatus.class));
        try {
            handler.afterConnectionEstablished(session);
            // 입장 알림 송신까지 끝낸 다음에만 다음 상태 프레임을 붙잡는다.
            verify(session, timeout(1000).times(2)).sendMessage(any());
            blockWrites.set(true);
            handler.updateRoom();
            assertTrue(writeStarted.await(1, TimeUnit.SECONDS));
            handler.handleMessage(session, new TextMessage("{\"type\":\"input\",\"x\":2,\"y\":0,\"seq\":1}"));
            assertTrue(room.snapshot().isEmpty(), "송신 대기와 관계없이 플레이어 상태는 즉시 제거한다");
            verify(session, never()).close(any(CloseStatus.class));
            releaseWrite.countDown();
            assertTrue(closed.await(2, TimeUnit.SECONDS));
            assertFalse(overlap.get(), "종료 프레임과 데이터 프레임을 동시에 송신하면 안 된다");
            verify(session).close(CloseStatus.POLICY_VIOLATION.withReason("Invalid input: axes"));
        } finally {
            releaseWrite.countDown();
            handler.stop();
        }
    }
}
