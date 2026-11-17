package kr.seulgae.techlab.multiplayer.lobby.websocket;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;
import tools.jackson.databind.json.JsonMapper;

/**
 * 제한된 입력 메시지를 받아 서버 상태를 20Hz로 전파하는 로비 소켓이다.
 *
 * @author seulgae
 * @version 1.0, 동일 연결의 방 이동·세대 검증과 방별 상태·채팅 방송
 * @see "None"
 */
@Component
public class LobbySocketHandler extends TextWebSocketHandler {
    private static final Logger LOG = LoggerFactory.getLogger(LobbySocketHandler.class);
    private static final Set<String> INPUT_FIELDS = Set.of("type", "x", "y", "seq");
    private static final Set<String> CHAT_FIELDS = Set.of("type", "message");
    private static final Set<String> SEAT_FIELDS = Set.of("type", "seatId");
    private static final Set<String> MOVE_FIELDS = Set.of("type", "inputs");
    private static final Set<String> COMMAND_FIELDS = Set.of("x", "y", "ms", "seq");
    private static final double INPUTS_PER_SECOND = 40;
    private static final double INPUT_BURST_CAPACITY = 80;
    /**
     * 운영 Funnel 경로는 왕복이 약 1초라 1초 송신 제한으로는 정상 연결도 끊긴다.
     * 이동 상태는 최신 1건만 남기므로 느린 연결은 갱신 빈도만 줄어든다.
     */
    static final int SEND_TIME_LIMIT_MS = 5000;
    static final int SEND_BUFFER_LIMIT_BYTES = 131072;
    /** 방 이동 때 승인·기록·입장 알림이 한꺼번에 쌓여도 넘치지 않는 제어 메시지 대기열 */
    static final int CONTROL_QUEUE_CAPACITY = 64;
    /** 관제실 CCTV 방별 목록 전송 간격(틱). 20Hz 상태 중 4틱마다, 약 5Hz */
    static final int FEED_EVERY_TICKS = 4;
    /** 핸드셰이크가 연결 속성에 남기는 방문자 주소 키 */
    public static final String CLIENT_ADDRESS = "lab.clientAddress";
    /** 같은 주소의 새 연결이 기존 연결을 대신할 때 보내는 종료 코드. 클라이언트는 이 코드에서 재연결하지 않는다. */
    public static final CloseStatus REPLACED = new CloseStatus(4409, "Replaced by a newer connection from the same address");
    /**
     * 연결별 송신 큐와 입력 제한·진단 정보를 보관한다.
     * @author seulgae
     * @version 1.0, 로비 연결 수명과 제한 상태
     * @see "None"
     */
    private static final class Peer {
        final WebSocketSession socket;
        final String playerId;
        final String address;
        final AtomicBoolean sending = new AtomicBoolean();
        final ArrayBlockingQueue<WebSocketMessage<?>> controls = new ArrayBlockingQueue<>(CONTROL_QUEUE_CAPACITY);
        final AtomicReference<WebSocketMessage<?>> latestState = new AtomicReference<>();
        final AtomicReference<CloseStatus> closing = new AtomicReference<>();
        volatile long lastSeen = System.nanoTime(), lastPing = lastSeen;
        final long connectedAt = System.nanoTime();
        long replenishedAt = connectedAt, receivedInputs;
        long ignoredInputs;
        double inputTokens = INPUT_BURST_CAPACITY;
        Peer(WebSocketSession socket, String playerId, String address) { this.socket = socket; this.playerId = playerId; this.address = address; }
        synchronized boolean allow(long now) {
            receivedInputs++;
            // 수신 시각에 몰린 정상 입력은 여유분으로 흡수하고 지속적인 과다 전송은 제한한다.
            inputTokens = Math.min(INPUT_BURST_CAPACITY,
                inputTokens + Math.max(0, now - replenishedAt) / 1_000_000_000d * INPUTS_PER_SECOND);
            replenishedAt = now;
            if (inputTokens < 1) return false;
            inputTokens--;
            return true;
        }
    }
    private final LobbyRoom room;
    private final LobbyChat chat;
    private final JsonMapper json = JsonMapper.builder().build();
    private final ConcurrentHashMap<String, Peer> peers = new ConcurrentHashMap<>();
    private final ExecutorService senders = Executors.newFixedThreadPool(LobbyRoom.MAX_PLAYERS);
    private final boolean singleConnectionPerAddress;
    private long lastTick = System.nanoTime(), tick;

    public LobbySocketHandler(LobbyRoom room, LobbyChat chat) { this(room, chat, false); }

    /**
     * @param singleConnectionPerAddress true면 한 주소에 연결 하나만 두고, 같은 주소의 새 연결이 기존 연결을 끊는다.
     *     로컬 개발·테스트는 모든 창이 127.0.0.1이라 기본값은 false이고, 운영 Compose에서 켠다.
     */
    @org.springframework.beans.factory.annotation.Autowired
    public LobbySocketHandler(LobbyRoom room, LobbyChat chat,
                              @org.springframework.beans.factory.annotation.Value("${lab.multiplayer.single-connection-per-address:false}") boolean singleConnectionPerAddress) {
        this.room = room; this.chat = chat; this.singleConnectionPerAddress = singleConnectionPerAddress;
    }

    /** 검증된 임시 이름으로 접속시키고 본인 ID와 전체 스냅샷을 먼저 전송한다. */
    @Override
    public synchronized void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.setTextMessageSizeLimit(1024);
        session.setBinaryMessageSizeLimit(128);
        String address = session.getAttributes().get(CLIENT_ADDRESS) instanceof String value ? value : null;
        if (singleConnectionPerAddress && address != null) {
            // 새 창·새로고침이 같은 주소의 이전 연결을 대신한다. 입장 전에 정리해 정원 계산에서도 빠지게 한다.
            peers.entrySet().stream().filter(entry -> address.equals(entry.getValue().address)).map(Map.Entry::getKey).toList()
                .forEach(id -> disconnect(id, REPLACED));
        }
        LobbyRoom.PlayerView player;
        try {
            var query = UriComponentsBuilder.fromUri(session.getUri()).build(true).getQueryParams();
            if (query.size() > 1 || !query.isEmpty() && (!query.containsKey("nickname") || query.get("nickname").size() != 1)) {
                throw new IllegalArgumentException("Invalid query");
            }
            String name = query.getFirst("nickname");
            player = room.join(name == null ? null : UriUtils.decode(name, StandardCharsets.UTF_8));
        } catch (IllegalArgumentException exception) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Invalid nickname"));
            return;
        } catch (IllegalStateException exception) {
            session.close(new CloseStatus(1013, "Lobby full"));
            return;
        }
        var socket = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES);
        try {
            // 입장 기록과 실시간 방송 사이에 메시지가 빠지지 않게 같은 채팅 잠금을 사용한다.
            synchronized (chat) {
                var peer = new Peer(socket, player.id(), address);
                peer.controls.add(new TextMessage(json.writeValueAsString(Map.of("type", "welcome", "selfId", player.id(), "players", room.snapshot("lobby"), "maxPlayers", LobbyRoom.MAX_PLAYERS, "protocolVersion", 4, "time", System.nanoTime() / 1_000_000d, "roomId", "lobby", "roomEpoch", 0))));
                peer.controls.add(new TextMessage(json.writeValueAsString(Map.of("type", "chat_history", "messages", chat.history()))));
                peers.put(session.getId(), peer);
                drain(session.getId(), peer);
            }
            broadcastIn("lobby", Map.of("type", "joined", "player", player));
        } catch (Exception exception) {
            room.leave(player.id());
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    /** 좌표·절대 시각은 받지 않고 방향·번호·짧은 스텝 시간을 엄격하게 검증한다. */
    @Override
    protected synchronized void handleTextMessage(WebSocketSession session, TextMessage message) {
        var peer = peers.get(session.getId());
        if (peer == null) return;
        long now = System.nanoTime();
        int payloadBytes = message.getPayload().getBytes(StandardCharsets.UTF_8).length;
        if (payloadBytes > 1024) {
            disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return;
        }
        String rejection = "Invalid input: JSON";
        try {
            var input = json.readTree(message.getPayload());
            if (input.isObject() && input.path("type").stringValue("").equals("room_change")) {
                try {
                    if (!peer.allow(now) || !Set.copyOf(input.propertyNames()).equals(Set.of("type", "doorId", "roomEpoch"))
                            || !input.path("doorId").isString() || !input.path("roomEpoch").isIntegralNumber()
                            || input.path("roomEpoch").asLong() != room.epoch(peer.playerId)) throw new IllegalArgumentException("Invalid room request");
                    synchronized (chat) {
                        String previous = room.roomId(peer.playerId);
                        room.changeRoom(peer.playerId, input.get("doorId").stringValue(), now);
                        peer.latestState.set(null);
                        sendScoped(session.getId(), peer, Map.of("type", "room_changed", "players", room.snapshot(room.roomId(peer.playerId)), "selfId", peer.playerId, "time", now / 1_000_000d));
                        sendScoped(session.getId(), peer, Map.of("type", "chat_history", "messages", chat.history(room.roomId(peer.playerId))));
                        broadcastIn(previous, Map.of("type", "left", "id", peer.playerId));
                        broadcastIn(room.roomId(peer.playerId), Map.of("type", "joined", "player", room.player(peer.playerId)));
                    }
                } catch (IllegalArgumentException exception) {
                    sendScoped(session.getId(), peer, Map.of("type", "room_error", "reason", "출입구와 거리를 확인해 주세요."));
                }
                peer.lastSeen = now;
                return;
            }
            long expectedEpoch = room.epoch(peer.playerId);
            if (input.has("roomEpoch") ? !input.get("roomEpoch").isIntegralNumber() || input.get("roomEpoch").asLong() != expectedEpoch : expectedEpoch != 0) return;
            if (input.isObject() && input.path("type").stringValue("").equals("seat")) {
                // 의자 앉기(seatId)·일어나기(null). 조건이 맞지 않으면 무시하고 다음 상태로 결과를 알린다.
                if (peer.allow(now)) {
                    var seat = input.get("seatId");
                    boolean valid = fields(input, SEAT_FIELDS) && seat != null
                        && (seat.isNull() || seat.isString() && seat.stringValue().matches("[a-z-]{1,32}-chair-[0-9]{1,2}"));
                    if (valid) room.sit(peer.playerId, seat.isNull() ? null : seat.stringValue());
                }
                peer.lastSeen = now;
                return;
            }
            if (input.isObject() && input.path("type").stringValue("").equals("chat")) {
                try {
                    synchronized (chat) {
                        if (peers.get(session.getId()) != peer) return;
                        // 부정한 필드 요청도 채팅 제한을 소비하게 해 반복 오류 방송을 막는다.
                        var scope = input.get("scope");
                        boolean validScope = scope == null || scope.isString() && Set.of(LobbyChat.Message.ROOM, LobbyChat.Message.TABLE).contains(scope.stringValue());
                        String text = validScope && fields(input, CHAT_FIELDS, "scope") && input.get("message").isString()
                            ? input.get("message").stringValue() : null;
                        boolean table = validScope && scope != null && scope.stringValue().equals(LobbyChat.Message.TABLE);
                        String roomId = room.roomId(peer.playerId);
                        var posted = chat.post(peer.playerId, text, now, table);
                        if (posted.table()) {
                            // 테이블 대화는 서버 좌표가 같은 테이블 범위 안인 같은 방 참가자에게만 전달한다.
                            var listeners = room.playersNear(roomId, LobbyChat.TABLE_KIND);
                            peers.forEach((id, other) -> { if (listeners.contains(other.playerId)) sendScoped(id, other, posted); });
                        } else broadcastIn(roomId, posted);
                    }
                } catch (LobbyChat.Rejected exception) {
                    sendScoped(session.getId(), peer, Map.of("type", "chat_error", "reason", exception.getMessage()));
                }
                peer.lastSeen = now;
                return;
            }
            if (payloadBytes > 512 && !input.path("type").stringValue("").equals("move")) {
                disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return;
            }
            if (!peer.allow(now)) {
                LOG.warn("Lobby input rate exceeded: player={}, receivedInputs={}, connectedMs={}",
                    peer.playerId, peer.receivedInputs, (now - peer.connectedAt) / 1_000_000);
                disconnect(session.getId(), CloseStatus.POLICY_VIOLATION.withReason("Input rate exceeded")); return;
            }
            if (input.isObject() && input.path("type").stringValue("").equals("move")) {
                rejection = "Invalid movement: fields";
                if (!fields(input, MOVE_FIELDS) || !input.get("inputs").isArray()
                    || input.get("inputs").isEmpty() || input.get("inputs").size() > 8) throw new IllegalArgumentException();
                var commands = new ArrayList<LobbyRoom.MoveCommand>();
                for (var command : input.get("inputs")) {
                    if (!command.isObject() || !Set.copyOf(command.propertyNames()).equals(COMMAND_FIELDS)
                        || !command.get("x").isInt() || !command.get("y").isInt() || !command.get("ms").isNumber()
                        || !command.get("seq").isIntegralNumber() || !command.get("seq").canConvertToLong()) throw new IllegalArgumentException();
                    commands.add(new LobbyRoom.MoveCommand(command.get("x").asInt(), command.get("y").asInt(),
                        command.get("ms").asDouble(), command.get("seq").asLong()));
                }
                try { room.commands(peer.playerId, commands, now); }
                catch (IllegalArgumentException exception) {
                    rejection = "Invalid movement: " + exception.getMessage();
                    throw exception;
                }
                peer.lastSeen = now;
                return;
            }
            rejection = "Invalid input: fields";
            if (!input.isObject() || !fields(input, INPUT_FIELDS)
                || !input.get("type").isString() || !input.get("type").stringValue().equals("input")) throw new IllegalArgumentException();
            rejection = "Invalid input: axes";
            if (!input.get("x").isInt() || !input.get("y").isInt()
                || Math.abs((long) input.get("x").asInt()) > 1 || Math.abs((long) input.get("y").asInt()) > 1) throw new IllegalArgumentException();
            rejection = "Invalid input: sequence";
            if (!input.get("seq").isIntegralNumber() || !input.get("seq").canConvertToLong()
                || input.get("seq").asLong() < 0 || input.get("seq").asLong() > 9_007_199_254_740_991L) {
                throw new IllegalArgumentException("Invalid input");
            }
            // 오래되거나 중복된 입력은 위치에 적용하지 않는다. 재전송만으로 연결을 끊지는 않는다.
            if (!room.input(peer.playerId, input.get("x").asInt(), input.get("y").asInt(), input.get("seq").asLong(), now)) {
                if (++peer.ignoredInputs == 1) LOG.warn("Lobby stale input ignored: player={}, seq={}", peer.playerId, input.get("seq").asLong());
                return;
            }
            peer.lastSeen = now;
        } catch (RuntimeException exception) {
            if (payloadBytes > 512 && rejection.equals("Invalid input: JSON")) {
                disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return;
            }
            LOG.warn("Lobby input rejected: player={}, validation={}, receivedInputs={}, connectedMs={}",
                peer.playerId, rejection, peer.receivedInputs, (now - peer.connectedAt) / 1_000_000);
            disconnect(session.getId(), CloseStatus.POLICY_VIOLATION.withReason(rejection));
        }
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        var peer = peers.get(session.getId());
        if (peer != null) peer.lastSeen = System.nanoTime();
    }

    /** 구형 이동과 원격 대기 상태를 갱신하고, 느린 연결에는 낡은 스냅샷을 쌓지 않는다. */
    @Scheduled(fixedRate = 50)
    public synchronized void updateRoom() {
        long now = System.nanoTime();
        room.step((now - lastTick) / 1_000_000_000d, now);
        lastTick = now;
        if (peers.isEmpty()) return;
        tick++;
        // 관제실 참가자에게만 방별 참가자 목록(feeds)을 4틱(약 5Hz)마다 덧붙인다.
        Map<String, java.util.List<LobbyRoom.PlayerView>> feeds = tick % FEED_EVERY_TICKS == 0 ? room.snapshotsByRoom() : null;
        peers.forEach((id, peer) -> {
            String roomId = room.roomId(peer.playerId);
            var state = new java.util.LinkedHashMap<String, Object>(Map.of("type", "state", "tick", tick, "time", now / 1_000_000d,
                "players", room.snapshot(roomId), "totalOnline", room.snapshot().size()));
            if (feeds != null && room.monitorsAllRooms(roomId)) state.put("feeds", feeds);
            sendScoped(id, peer, state);
        });
        peers.forEach((id, peer) -> {
            boolean slowSend = peer.socket instanceof ConcurrentWebSocketSessionDecorator decorated && decorated.getTimeSinceSendStarted() > SEND_TIME_LIMIT_MS;
            if (slowSend || now - peer.lastSeen > 15_000_000_000L) disconnect(id, CloseStatus.SESSION_NOT_RELIABLE);
            else if (now - peer.lastPing > 5_000_000_000L) {
                peer.lastPing = now;
                dispatch(id, peer, new PingMessage(), true);
            }
        });
    }

    /** 이동 입력 필드에는 선택적인 방 세대만 추가할 수 있다. */
    private boolean fields(tools.jackson.databind.JsonNode input, Set<String> expected, String... optional) {
        var keys = new java.util.HashSet<>(input.propertyNames());
        keys.remove("roomEpoch");
        for (var key : optional) keys.remove(key);
        return keys.equals(expected);
    }

    /** 모든 방 이벤트에 수신자의 방 세대를 붙여 오래된 이벤트를 구분한다. */
    private void sendScoped(String id, Peer peer, Object payload) {
        var node = json.valueToTree(payload);
        var envelope = (tools.jackson.databind.node.ObjectNode) node;
        envelope.put("roomId", room.roomId(peer.playerId));
        envelope.put("roomEpoch", room.epoch(peer.playerId));
        dispatch(id, peer, new TextMessage(json.writeValueAsString(envelope)), !node.path("type").stringValue("").equals("state"));
    }

    private void broadcastIn(String roomId, Object payload) {
        peers.forEach((id, peer) -> { if (roomId.equals(room.roomId(peer.playerId))) sendScoped(id, peer, payload); });
    }

    private void dispatch(String id, Peer peer, WebSocketMessage<?> message, boolean reliable) {
        if (peers.get(id) != peer) return;
        if (reliable) {
            if (!peer.controls.offer(message)) { disconnect(id, CloseStatus.SESSION_NOT_RELIABLE); return; }
        } else peer.latestState.set(message);
        drain(id, peer);
    }

    private void drain(String id, Peer peer) {
        if (!peer.sending.compareAndSet(false, true)) return;
        // 입퇴장 알림은 제한된 큐로 보존하고, 이동 스냅샷은 가장 최신 한 건만 남긴다.
        try {
            senders.execute(() -> {
                try {
                    while (true) {
                        var closeStatus = peer.closing.getAndSet(null);
                        if (closeStatus != null) {
                            if (peer.socket.isOpen()) peer.socket.close(closeStatus);
                            break;
                        }
                        if (!peer.socket.isOpen() || peers.get(id) != peer) break;
                        var message = peer.controls.poll();
                        if (message == null) message = peer.latestState.getAndSet(null);
                        if (message == null) break;
                        peer.socket.sendMessage(message);
                    }
                }
                catch (Exception exception) { disconnect(id, CloseStatus.SESSION_NOT_RELIABLE); }
                finally {
                    peer.sending.set(false);
                    if (peer.closing.get() != null || peers.get(id) == peer && (!peer.controls.isEmpty() || peer.latestState.get() != null)) drain(id, peer);
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException exception) { peer.sending.set(false); }
    }

    private synchronized void disconnect(String id, CloseStatus status) {
        var peer = peers.remove(id);
        if (peer == null) return;
        LOG.info("Lobby connection closed: player={}, code={}, reason={}, receivedInputs={}, connectedMs={}",
            peer.playerId, status.getCode(), status.getReason(), peer.receivedInputs,
            (System.nanoTime() - peer.connectedAt) / 1_000_000);
        String previousRoom = room.roomId(peer.playerId);
        room.leave(peer.playerId);
        chat.leave(peer.playerId);
        peer.controls.clear();
        peer.latestState.set(null);
        // 정상적인 종료 프레임은 진행 중인 송신이 끝난 뒤 같은 작업자에서 전송한다.
        // 느리거나 손상된 연결은 송신 완료를 기다리지 않고 즉시 정리한다.
        if (CloseStatus.SESSION_NOT_RELIABLE.equals(status)) {
            try { if (peer.socket.isOpen()) peer.socket.close(status); } catch (IOException ignored) { }
        } else {
            peer.closing.set(status);
            drain(id, peer);
        }
        broadcastIn(previousRoom, Map.of("type", "left", "id", peer.playerId));
    }

    @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) { disconnect(session.getId(), status); }
    @Override public void handleTransportError(WebSocketSession session, Throwable exception) { disconnect(session.getId(), CloseStatus.SERVER_ERROR); }

    @PreDestroy
    public void stop() {
        peers.keySet().forEach(id -> disconnect(id, CloseStatus.GOING_AWAY));
        senders.shutdown();
    }
}
