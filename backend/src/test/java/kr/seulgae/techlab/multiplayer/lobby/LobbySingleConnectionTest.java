package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.multiplayer.lobby.domain.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 운영 설정(한 주소 한 연결)에서 같은 주소의 새 연결이 기존 연결을 대신하는지 실제 소켓으로 검증한다.
 *
 * @author seulgae
 * @version 1.0, 같은 IP 중복 접속 정리
 * @see "None"
 */
@SpringBootTest(classes = LocalLobbyTestApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"lab.multiplayer.allowed-origins=http://localhost:5188", "lab.multiplayer.single-connection-per-address=true"})
class LobbySingleConnectionTest {
    @Autowired Environment environment;
    @Autowired LobbyRoom room;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final List<Client> clients = new ArrayList<>();

    /**
     * welcome 수신 여부와 종료 코드만 보관하는 테스트 방문자이다.
     * @author seulgae
     * @version 1.0, 중복 접속 종료 코드 확인
     * @see "None"
     */
    private static final class Client implements WebSocket.Listener {
        final CompletableFuture<Void> welcomed = new CompletableFuture<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        final StringBuilder pending = new StringBuilder();
        WebSocket socket;
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            pending.append(data);
            if (last) { if (pending.indexOf("\"type\":\"welcome\"") >= 0) welcomed.complete(null); pending.setLength(0); }
            socket.request(1);
            return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int status, String reason) { closed.complete(status); return null; }
    }

    private Client connect(String forwardedFor) throws Exception {
        var client = new Client();
        client.socket = http.newWebSocketBuilder().header("Origin", "http://localhost:5188").header("X-Forwarded-For", forwardedFor)
            .buildAsync(URI.create("ws://127.0.0.1:" + environment.getProperty("local.server.port") + "/ws/lobby"), client)
            .get(5, TimeUnit.SECONDS);
        clients.add(client);
        client.welcomed.get(5, TimeUnit.SECONDS);
        return client;
    }

    /** 같은 주소로 새 창을 열면 기존 연결은 4409로 끊기고 인원은 늘지 않는다. 다른 주소는 영향이 없다. */
    @Test void newConnectionFromSameAddressReplacesOldOne() throws Exception {
        var first = connect("198.51.100.7");
        var other = connect("198.51.100.8, 10.0.0.2");
        var second = connect("198.51.100.7, 10.0.0.2");
        assertEquals(4409, first.closed.get(3, TimeUnit.SECONDS), "기존 연결은 대체 코드로 끊긴다");
        long deadline = System.nanoTime() + 2_000_000_000L;
        while (room.snapshot().size() != 2 && System.nanoTime() < deadline) Thread.sleep(10);
        assertEquals(2, room.snapshot().size(), "같은 주소는 한 명으로만 센다");
        assertFalse(second.closed.isDone());
        assertFalse(other.closed.isDone(), "다른 주소의 연결은 유지된다");
    }

    @AfterEach void cleanup() throws Exception {
        for (var client : clients) {
            if (!client.closed.isDone()) {
                try { client.socket.sendClose(1000, "Test complete").get(2, TimeUnit.SECONDS); client.closed.get(2, TimeUnit.SECONDS); }
                catch (Exception ignored) { client.socket.abort(); }
            }
        }
        long deadline = System.nanoTime() + 2_000_000_000L;
        while (!room.snapshot().isEmpty() && System.nanoTime() < deadline) Thread.sleep(10);
        assertTrue(room.snapshot().isEmpty());
    }
}
