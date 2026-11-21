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
 * @version 1.0, 물리 홈서버·SSH 터널 Origin 허용 및 위장 Origin 거부 검증
 * @see "None"
 */
@SpringBootTest(classes = LocalLobbyTestApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "lab.multiplayer.allowed-origins=https://seulgae-home-server.tailac4b36.ts.net,http://127.0.0.1:5188,http://localhost:5188")
class LobbySocketTest {
    @Autowired Environment environment;
    @Autowired LobbyRoom room;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final List<Client> clients = new ArrayList<>();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    /**
     * 통합 검증의 수신 프레임과 종료 코드·사유를 보관하는 소켓 방문자이다.
     * @author seulgae
     * @version 1.0, 실제 연결의 상태 및 진단 사유 검증
     * @see "None"
     */
    private static final class Client implements WebSocket.Listener {
        final BlockingQueue<JsonNode> frames = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        final StringBuilder pending = new StringBuilder();
        WebSocket socket;
        volatile String closeReason;
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            pending.append(data);
            if (last) { frames.add(JSON.readTree(pending.toString())); pending.setLength(0); }
            socket.request(1);
            return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int status, String reason) { closeReason = reason; closed.complete(status); return null; }
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

    /** 멀티플레이는 회의실에서만: 소켓은 회의실로 바로 입장하고, 서버 방 이동은 거절한다. */
    @Test void joinsMeetingRoomDirectlyAndRefusesServerRoomChanges() throws Exception {
        var a = connect(""); var welcome = a.type("welcome");
        String id = welcome.get("selfId").stringValue();
        assertEquals("meeting-room", welcome.get("roomId").stringValue());
        assertEquals("meeting-room", room.roomId(id));
        assertEquals(400, room.player(id).x(), .001, "회의실 스폰");
        assertEquals(480, room.player(id).y(), .001);
        a.type("chat_history");
        var b = connect(""); String other = b.type("welcome").get("selfId").stringValue(); b.type("chat_history");
        assertNotEquals(room.player(id).x(), room.player(other).x(), "두 번째 사람은 옆에 선다");
        a.send("{\"type\":\"room_change\",\"doorId\":\"meeting-to-development\",\"roomEpoch\":0}");
        assertTrue(a.type("room_error").get("reason").stringValue().contains("회의실"));
        assertEquals("meeting-room", room.roomId(id), "서버 방 이동은 하지 않는다");
        a.send("{\"type\":\"chat\",\"message\":\"회의 시작할게요\"}");
        assertEquals("회의 시작할게요", b.type("chat_message").get("message").stringValue());
        assertFalse(a.closed.isDone());
    }

    /** 실제 WebSocket에서도 처리 완료 ack와 정지 끝점이 두 방문자에게 같아야 한다. */
    @Test void broadcastsCompletedCommandAckWithoutServerTickDrift() throws Exception {
        var a = connect(""); var welcome = a.type("welcome");
        assertEquals(4, welcome.get("protocolVersion").asInt());
        String id = welcome.get("selfId").stringValue();
        double initialX = room.player(id).x();
        var b = connect(""); b.type("welcome");
        String move = "{\"type\":\"move\",\"inputs\":[{\"x\":1,\"y\":0,\"ms\":50,\"seq\":1},{\"x\":0,\"y\":0,\"ms\":0,\"seq\":2}]}";
        a.send(move);
        b.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").valueStream()
            .anyMatch(player -> player.get("id").stringValue().equals(id) && player.get("ack").asLong() == 2));
        assertEquals(initialX + 10, room.player(id).x(), 1e-8);
        a.send(move);
        Thread.sleep(150);
        assertEquals(initialX + 10, room.player(id).x(), 1e-8);
        assertFalse(a.closed.isDone());
        a.send("{\"type\":\"move\",\"inputs\":[{\"x\":2,\"y\":0,\"ms\":16,\"seq\":3}]}");
        assertEquals(1008, a.closed.get(3, TimeUnit.SECONDS));
        assertEquals("Invalid movement: Movement axes", a.closeReason);
    }

    /** 실제 소켓에서 3초 입력 몰림을 받은 뒤에도 연결을 유지하고 stop까지 ack한다. */
    @Test void keepsConnectionForMovementBurstBeyondImmediateTimeBudget() throws Exception {
        var a = connect(""); var welcome = a.type("welcome");
        String id = welcome.get("selfId").stringValue();
        Thread.sleep(3100);
        for (int start = 1; start <= 180; start += 8) {
            var commands = new ArrayList<LobbyRoom.MoveCommand>();
            for (int seq = start; seq < Math.min(start + 8, 181); seq++) commands.add(new LobbyRoom.MoveCommand(1, 0, 1000d / 60, seq));
            a.send(JSON.writeValueAsString(java.util.Map.of("type", "move", "inputs", commands)));
        }
        a.send("{\"type\":\"move\",\"inputs\":[{\"x\":0,\"y\":0,\"ms\":0,\"seq\":181}]}");
        a.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").valueStream()
            .anyMatch(player -> player.get("id").stringValue().equals(id) && player.get("ack").asLong() == 181));
        assertFalse(a.closed.isDone()); assertFalse(room.player(id).moving());
    }
    private Client connect(String query) throws Exception {
        return connect(query, "http://localhost:5188");
    }

    /**
     * 지정 Origin으로 실제 핸드셰이크를 수행하고 종료 정리 대상에 등록한다.
     * @param query 연결 URL에 붙일 테스트 쿼리
     * @param origin 핸드셰이크에 전달할 Origin
     * @return 연결된 테스트 방문자
     * @throws Exception 연결 실패 또는 시간 초과
     */
    private Client connect(String query, String origin) throws Exception {
        var client = new Client();
        client.socket = http.newWebSocketBuilder().header("Origin", origin)
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

    /** 방송·과거 기록·사칭/도배 차단이 이동 ACK 및 기존 연결에 영향을 주지 않는다. */
    @Test void broadcastsChatAndHistoryWithIndependentValidation() throws Exception {
        var a = connect("?nickname=Alpha"); String aid = a.type("welcome").get("selfId").stringValue(); a.type("chat_history");
        var b = connect(""); b.type("welcome"); b.type("chat_history");
        a.send("{\"type\":\"chat\",\"message\":\"안녕하세요!\"}");
        var message = a.type("chat_message");
        assertEquals(aid, message.get("playerId").stringValue());
        assertEquals("Alpha", message.get("nickname").stringValue());
        assertEquals(message, b.type("chat_message"));
        var c = connect(""); c.type("welcome");
        assertTrue(c.type("chat_history").get("messages").valueStream()
            .anyMatch(entry -> entry.get("messageId").equals(message.get("messageId"))));
        a.send("{\"type\":\"chat\",\"message\":\"위조\",\"nickname\":\"Other\"}");
        assertEquals("invalid", a.type("chat_error").get("reason").stringValue());
        a.send("{\"type\":\"chat\",\"message\":\" \"}");
        assertEquals("empty", a.type("chat_error").get("reason").stringValue());
        for (int i = 0; i < 8; i++) a.send("{\"type\":\"chat\",\"message\":\"과다\"}");
        assertEquals("rate_limited", a.type("chat_error").get("reason").stringValue());
        a.send("{\"type\":\"input\",\"x\":0,\"y\":0,\"seq\":1}");
        a.await(frame -> frame.path("type").stringValue("").equals("state") && frame.get("players").valueStream()
            .anyMatch(player -> player.get("id").stringValue().equals(aid) && player.get("ack").asLong() == 1));
        assertFalse(a.closed.isDone());
        String emojiText = "👋".repeat(150);
        b.send(JSON.writeValueAsString(java.util.Map.of("type", "chat", "message", emojiText)));
        b.await(frame -> frame.path("type").stringValue("").equals("chat_message") && frame.get("message").stringValue().equals(emojiText));
        b.send(JSON.writeValueAsString(java.util.Map.of("type", "chat", "message", "👋".repeat(151))));
        assertEquals("too_long", b.type("chat_error").get("reason").stringValue());
        assertFalse(b.closed.isDone());
    }

    /** 테이블 범위 밖 근거리 대화와 알 수 없는 범위는 연결을 유지한 채 거부한다. */
    @Test void rejectsTableTalkAwayFromTableAndUnknownScope() throws Exception {
        var a = connect(""); a.type("welcome"); a.type("chat_history");
        a.send("{\"type\":\"chat\",\"message\":\"테이블\",\"scope\":\"table\",\"roomEpoch\":0}");
        assertEquals("not_at_table", a.type("chat_error").get("reason").stringValue());
        a.send("{\"type\":\"chat\",\"message\":\"전체\",\"scope\":\"everyone\",\"roomEpoch\":0}");
        assertEquals("invalid", a.type("chat_error").get("reason").stringValue());
        a.send("{\"type\":\"chat\",\"message\":\"방 전체\",\"scope\":\"room\",\"roomEpoch\":0}");
        var message = a.type("chat_message");
        assertEquals("room", message.get("scope").stringValue());
        assertFalse(message.has("table"));
        assertFalse(a.closed.isDone());
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

    /** 운영 HTTPS 및 두 SSH 터널 Origin은 welcome 프레임까지 수신해야 한다. */
    @Test void acceptsHomeServerAndTunnelOrigins() throws Exception {
        for (String origin : List.of("https://seulgae-home-server.tailac4b36.ts.net",
                "http://127.0.0.1:5188", "http://localhost:5188")) {
            assertEquals("welcome", connect("", origin).type("welcome").get("type").stringValue());
        }
    }

    /** 예전 도메인·위장 호스트·잘못된 스킴/포트·누락 Origin은 403으로 거부한다. */
    @Test void rejectsForeignAndMissingOrigins() {
        for (String origin : List.of("https://example.invalid", "", "null", "*",
                "https://seulgae-server.tailac4b36.ts.net",
                "https://seulgae-home-server.tailac4b36.ts.net.evil.invalid",
                "http://seulgae-home-server.tailac4b36.ts.net",
                "https://seulgae-home-server.tailac4b36.ts.net:8443", "http://localhost:5189")) {
            var builder = http.newWebSocketBuilder();
            if (!origin.isEmpty()) builder.header("Origin", origin);
            var exception = assertThrows(ExecutionException.class, () -> builder.buildAsync(URI.create("ws://127.0.0.1:" + port() + "/ws/lobby"), new Client()).get(5, TimeUnit.SECONDS));
            assertInstanceOf(WebSocketHandshakeException.class, exception.getCause());
            assertEquals(403, ((WebSocketHandshakeException) exception.getCause()).getResponse().statusCode());
        }
    }

    /** 회의실 아이템 교환은 로그인 회원만: 비회원이 신청하면 login으로 답하고 연결은 유지한다. */
    @Test void guestsAreAskedToLogInBeforeTrading() throws Exception {
        var a = connect(""); a.type("welcome");
        var b = connect(""); String other = b.type("welcome").get("selfId").stringValue();
        a.send("{\"type\":\"trade_offer\",\"to\":\"" + other + "\",\"itemId\":\"00000000-0000-4000-8000-0000000000aa\"}");
        var status = a.type("trade_status");
        assertEquals("failed", status.get("status").stringValue());
        assertEquals("login", status.get("reason").stringValue());
        assertFalse(a.closed.isDone());
    }

    /** 바닥 아이템은 소켓이 아니라 REST로 읽고 쓴다(회의실 밖에는 소켓이 없다). 비회원은 줍기·버리기를 할 수 없다. */
    @Test void groundItemsUseRestAndGuestsCannotPickOrDrop() throws Exception {
        String base = "http://127.0.0.1:" + port() + "/api/inventory";
        var ground = http.send(HttpRequest.newBuilder(URI.create(base + "/ground?room=outdoor")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, ground.statusCode());
        assertTrue(JSON.readTree(ground.body()).isEmpty());
        assertEquals(400, http.send(HttpRequest.newBuilder(URI.create(base + "/ground?room=moon")).GET().build(), HttpResponse.BodyHandlers.ofString()).statusCode());
        var pick = http.send(HttpRequest.newBuilder(URI.create(base + "/pick")).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"itemId\":\"00000000-0000-4000-8000-0000000000aa\",\"room\":\"outdoor\",\"x\":600,\"y\":470}")).build(),
            HttpResponse.BodyHandlers.ofString());
        assertEquals(401, pick.statusCode(), "비회원은 로그인 안내");
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
