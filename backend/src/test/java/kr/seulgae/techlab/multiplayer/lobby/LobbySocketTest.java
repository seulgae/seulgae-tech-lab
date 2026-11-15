package kr.seulgae.techlab.multiplayer.lobby;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.function.Predicate;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 실제 로컬 Tomcat의 핸드셰이크·방송·퇴장·입력 제한을 검증한다.
 *
 * @author seulgae
 * @version 1.0, DB 없는 HTTP 및 WebSocket 통합 검증
 * @see "None"
 */
@SpringBootTest(classes = LocalLobbyTestApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LobbySocketTest {
    @Autowired Environment environment;
    @Autowired LobbyRoom room;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final List<Client> clients = new ArrayList<>();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static final class Client implements WebSocket.Listener {
        final BlockingQueue<JsonNode> frames = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        final StringBuilder pending = new StringBuilder();
        WebSocket socket;
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            pending.append(data);
            if (last) { frames.add(JSON.readTree(pending.toString())); pending.setLength(0); }
            socket.request(1);
            return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int status, String reason) { closed.complete(status); return null; }
        JsonNode await(Predicate<JsonNode> predicate) throws Exception {
            long deadline = System.nanoTime() + 5_000_000_000L;
            while (System.nanoTime() < deadline) {
                var frame = frames.poll(100, TimeUnit.MILLISECONDS);
                if (frame != null && predicate.test(frame)) return frame;
            }
            throw new AssertionError("Expected WebSocket frame not received");
        }
        JsonNode type(String type) throws Exception { return await(frame -> frame.path("type").stringValue("").equals(type)); }
        void send(String input) { socket.sendText(input, true).join(); }
    }

    private int port() { return environment.getProperty("local.server.port", Integer.class); }
    private Client connect(String query) throws Exception {
        var client = new Client();
        client.socket = http.newWebSocketBuilder().header("Origin", "http://localhost:5173")
            .buildAsync(URI.create("ws://127.0.0.1:" + port() + "/ws/lobby" + query), client).get(5, TimeUnit.SECONDS);
        clients.add(client);
        return client;
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

    @Test void welcomesTwoClientsSynchronizesMovementAndAnnouncesDeparture() throws Exception {
        var a = connect(""); var welcomeA = a.type("welcome");
        String firstId = welcomeA.get("selfId").stringValue();
        double initialX = welcomeA.get("players").get(0).get("x").asDouble();
        var b = connect(""); b.type("welcome");
        a.type("joined");
        a.send("{\"type\":\"input\",\"x\":1,\"y\":0,\"seq\":1}");
        b.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").valueStream().anyMatch(player -> player.get("id").stringValue().equals(firstId) && player.get("x").asDouble() > initialX + 5 && player.get("facing").stringValue().equals("right")));
        a.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":2}");
        a.socket.sendClose(1000, "Leaving").join(); a.closed.get(3, TimeUnit.SECONDS);
        assertEquals(firstId, b.type("left").get("id").stringValue());
        b.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").size() == 1);
        var rejoined = connect("");
        assertNotEquals(firstId, rejoined.type("welcome").get("selfId").stringValue());
    }

    @org.junit.jupiter.api.RepeatedTest(10) void rejectsUnexpectedCoordinatesAndReplay() throws Exception {
        for (String input : List.of(
            "{\"type\":\"input\",\"x\":1,\"y\":0,\"seq\":1,\"position\":99999}",
            "{\"type\":\"input\",\"x\":2,\"y\":0,\"seq\":1}",
            "{\"type\":\"input\",\"x\":0.5,\"y\":0,\"seq\":1}",
            "{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":-1}")) {
            var client = connect(""); client.type("welcome");
            client.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":0}");
            // 첫 입력 수신을 확인해 접속 등록과 재전송 검증의 실행 순서를 고정한다.
            client.await(frame -> frame.path("type").stringValue("").equals("state")
                && frame.get("players").get(0).get("ack").asLong() == 0);
            client.send(input);
            assertEquals(1008, client.closed.get(3, TimeUnit.SECONDS));
        }
    }

    /** 재전송은 무시하되 정상 후속 입력과 연결은 유지한다. */
    @Test void ignoresStaleInputWithoutClosingHealthyConnection() throws Exception {
        var client = connect(""); client.type("welcome");
        client.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":2}");
        client.send("{\"type\":\"input\",\"x\":-1,\"y\":0,\"seq\":1}");
        client.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":2}");
        client.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").get(0).get("ack").asLong() == 2);
        assertFalse(client.closed.isDone());
        client.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":3}");
        client.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").get(0).get("ack").asLong() == 3);
    }

    /** 가까워진 뒤에만 서버 고정 문구를 세 방문자 모두에게 전달한다. */
    @Test void synchronizesValidatedGreetingAndRejectsInjectedText() throws Exception {
        var a = connect(""); var aw = a.type("welcome");
        String aid = aw.get("selfId").stringValue();
        var b = connect(""); String bid = b.type("welcome").get("selfId").stringValue();
        var c = connect(""); c.type("welcome");
        a.send("{\"type\":\"input\",\"x\":1,\"y\":0,\"seq\":1}");
        a.await(frame -> frame.path("type").stringValue("").equals("state")
            && frame.get("players").valueStream().anyMatch(p -> p.get("id").stringValue().equals(aid) && p.get("x").asDouble() >= 435));
        a.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":2}");
        a.send("{\"type\":\"greet\",\"targetPlayerId\":\"" + bid + "\"}");
        var event = a.type("player_greeted");
        assertEquals("하이! 👋", event.get("message").stringValue());
        assertEquals(3000, event.get("durationMs").asInt());
        assertEquals(aid, event.get("playerId").stringValue());
        assertEquals(bid, event.get("targetPlayerId").stringValue());
        assertEquals(event, b.type("player_greeted"));
        assertEquals(event, c.type("player_greeted"));
        a.send("{\"type\":\"greet\",\"targetPlayerId\":\"" + bid + "\"}");
        a.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":3}");
        a.await(frame -> frame.path("type").stringValue("").equals("state")
            && frame.get("players").get(0).get("ack").asLong() == 3);
        assertFalse(a.frames.stream().anyMatch(f -> f.path("type").stringValue("").equals("player_greeted")));
        assertFalse(a.closed.isDone());
        a.send("{\"type\":\"greet\",\"targetPlayerId\":\"" + bid + "\",\"message\":\"arbitrary\"}");
        assertEquals(1008, a.closed.get(3, TimeUnit.SECONDS));
    }

    @Test void limitsCapacityNicknamePayloadAndInputRate() throws Exception {
        var invalidName = connect("?nickname=%3Cbad%3E");
        assertEquals(1008, invalidName.closed.get(3, TimeUnit.SECONDS));
        var large = connect(""); large.type("welcome"); large.send("a".repeat(600));
        assertEquals(1009, large.closed.get(3, TimeUnit.SECONDS));
        var fast = connect(""); fast.type("welcome");
        for (int i = 0; i < 160 && !fast.closed.isDone(); i++) {
            try { fast.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":" + i + "}"); }
            catch (CompletionException ignored) { break; }
        }
        assertEquals(1008, fast.closed.get(3, TimeUnit.SECONDS));
        for (int i = 0; i < 5; i++) connect("").type("welcome");
        var full = connect("");
        assertEquals(1013, full.closed.get(3, TimeUnit.SECONDS));
    }

    /** 정상 20Hz 입력 약 2초 분량이 지연 후 몰려도 연결을 유지해야 한다. */
    @Test void acceptsBatchedInputsAfterShortTransportDelay() throws Exception {
        var client = connect("");
        client.type("welcome");
        client.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":0}");
        client.await(frame -> frame.path("type").stringValue("").equals("state")
            && frame.get("players").get(0).get("ack").asLong() == 0);
        for (int sequence = 1; sequence <= 45; sequence++) {
            client.send("{\"type\":\"input\",\"x\":" + (sequence % 3 - 1)
                + ",\"y\":0,\"seq\":" + sequence + "}");
        }
        client.await(frame -> frame.path("type").stringValue("").equals("state")
            && frame.get("players").get(0).get("ack").asLong() == 45);
        assertFalse(client.closed.isDone());
        // 몰림 이후에도 정상 주기의 방향 변경 입력을 계속 수용해야 한다.
        for (int sequence = 46; sequence <= 65; sequence++) {
            Thread.sleep(50);
            client.send("{\"type\":\"input\",\"x\":" + (sequence % 3 - 1)
                + ",\"y\":0,\"seq\":" + sequence + "}");
        }
        client.await(frame -> frame.path("type").stringValue("").equals("state")
            && frame.get("players").get(0).get("ack").asLong() == 65);
        assertFalse(client.closed.isDone());
    }

    @Test void rejectsForeignAndMissingOrigins() {
        for (String origin : List.of("https://example.invalid", "")) {
            var builder = http.newWebSocketBuilder();
            if (!origin.isEmpty()) builder.header("Origin", origin);
            var exception = assertThrows(ExecutionException.class, () -> builder.buildAsync(URI.create("ws://127.0.0.1:" + port() + "/ws/lobby"), new Client()).get(5, TimeUnit.SECONDS));
            assertInstanceOf(WebSocketHandshakeException.class, exception.getCause());
            assertEquals(403, ((WebSocketHandshakeException) exception.getCause()).getResponse().statusCode());
        }
    }

    @Test void keepsResearchReadRoutesAndResponseContractAvailable() throws Exception {
        String base = "http://127.0.0.1:" + port() + "/api/research-records";
        var list = http.send(HttpRequest.newBuilder(URI.create(base + "?limit=10")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, list.statusCode());
        var page = JSON.readTree(list.body());
        assertEquals(1, page.get("items").size());
        assertFalse(page.get("hasMore").asBoolean());
        var detail = http.send(HttpRequest.newBuilder(URI.create(base + "/" + LocalLobbyTestApplication.RECORD_ID)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, detail.statusCode());
        assertTrue(JSON.readTree(detail.body()).get("content").stringValue().contains("로컬"));
    }
}
