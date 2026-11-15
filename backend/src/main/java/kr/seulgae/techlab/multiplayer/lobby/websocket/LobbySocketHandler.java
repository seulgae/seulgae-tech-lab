package kr.seulgae.techlab.multiplayer.lobby.websocket;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
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
 * @version 1.0, 입력 검증·속도 제한·접속 정리 및 상태 방송
 * @see "None"
 */
@Component
public class LobbySocketHandler extends TextWebSocketHandler {
    private static final Set<String> INPUT_FIELDS = Set.of("type", "x", "y", "seq");
    private static final class Peer {
        final WebSocketSession socket;
        final String playerId;
        final AtomicBoolean sending = new AtomicBoolean();
        final ArrayBlockingQueue<WebSocketMessage<?>> controls = new ArrayBlockingQueue<>(16);
        final AtomicReference<WebSocketMessage<?>> latestState = new AtomicReference<>();
        volatile long lastSeen = System.nanoTime(), lastPing;
        long windowStart = System.nanoTime();
        int messages;
        Peer(WebSocketSession socket, String playerId) { this.socket = socket; this.playerId = playerId; }
        synchronized boolean allow(long now) {
            if (now - windowStart >= 1_000_000_000L) { windowStart = now; messages = 0; }
            return ++messages <= 40;
        }
    }
    private final LobbyRoom room;
    private final JsonMapper json = JsonMapper.builder().build();
    private final ConcurrentHashMap<String, Peer> peers = new ConcurrentHashMap<>();
    private final ExecutorService senders = Executors.newFixedThreadPool(LobbyRoom.MAX_PLAYERS);
    private long lastTick = System.nanoTime(), tick;

    public LobbySocketHandler(LobbyRoom room) { this.room = room; }

    /** 검증된 임시 이름으로 접속시키고 본인 ID와 전체 스냅샷을 먼저 전송한다. */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.setTextMessageSizeLimit(512);
        session.setBinaryMessageSizeLimit(128);
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
        var socket = new ConcurrentWebSocketSessionDecorator(session, 1000, 8192);
        try {
            socket.sendMessage(new TextMessage(json.writeValueAsString(Map.of("type", "welcome", "selfId", player.id(), "players", room.snapshot(), "maxPlayers", LobbyRoom.MAX_PLAYERS))));
            peers.put(session.getId(), new Peer(socket, player.id()));
            broadcast(Map.of("type", "joined", "player", player));
        } catch (Exception exception) {
            room.leave(player.id());
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    /** 좌표나 클라이언트 시각을 받지 않고 방향과 입력 번호만 엄격하게 검증한다. */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        var peer = peers.get(session.getId());
        if (peer == null) return;
        long now = System.nanoTime();
        if (message.getPayload().getBytes(StandardCharsets.UTF_8).length > 512) {
            disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return;
        }
        if (!peer.allow(now)) { disconnect(session.getId(), CloseStatus.POLICY_VIOLATION.withReason("Input rate exceeded")); return; }
        try {
            var input = json.readTree(message.getPayload());
            if (!input.isObject() || !Set.copyOf(input.propertyNames()).equals(INPUT_FIELDS) || !input.get("type").isString()
                || !input.get("type").stringValue().equals("input") || !input.get("x").isInt() || !input.get("y").isInt()
                || !input.get("seq").isIntegralNumber() || !room.input(peer.playerId, input.get("x").asInt(), input.get("y").asInt(), input.get("seq").asLong(), now)) {
                throw new IllegalArgumentException("Invalid input");
            }
            peer.lastSeen = now;
        } catch (RuntimeException exception) {
            disconnect(session.getId(), CloseStatus.POLICY_VIOLATION.withReason("Invalid input"));
        }
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        var peer = peers.get(session.getId());
        if (peer != null) peer.lastSeen = System.nanoTime();
    }

    /** 서버 시계로만 이동하고, 느린 연결에는 낡은 스냅샷을 쌓지 않는다. */
    @Scheduled(fixedRate = 50)
    public void updateRoom() {
        long now = System.nanoTime();
        room.step((now - lastTick) / 1_000_000_000d, now);
        lastTick = now;
        if (peers.isEmpty()) return;
        broadcast(Map.of("type", "state", "tick", ++tick, "players", room.snapshot()));
        peers.forEach((id, peer) -> {
            boolean slowSend = peer.socket instanceof ConcurrentWebSocketSessionDecorator decorated && decorated.getTimeSinceSendStarted() > 1000;
            if (slowSend || now - peer.lastSeen > 15_000_000_000L) disconnect(id, CloseStatus.SESSION_NOT_RELIABLE);
            else if (now - peer.lastPing > 5_000_000_000L) {
                peer.lastPing = now;
                dispatch(id, peer, new PingMessage(), true);
            }
        });
    }

    private void broadcast(Object payload) {
        var message = new TextMessage(json.writeValueAsString(payload));
        boolean reliable = !"state".equals(((Map<?, ?>) payload).get("type"));
        peers.forEach((id, peer) -> dispatch(id, peer, message, reliable));
    }

    private void dispatch(String id, Peer peer, WebSocketMessage<?> message, boolean reliable) {
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
                    while (peer.socket.isOpen()) {
                        var message = peer.controls.poll();
                        if (message == null) message = peer.latestState.getAndSet(null);
                        if (message == null) break;
                        peer.socket.sendMessage(message);
                    }
                }
                catch (Exception exception) { disconnect(id, CloseStatus.SESSION_NOT_RELIABLE); }
                finally {
                    peer.sending.set(false);
                    if (peers.get(id) == peer && (!peer.controls.isEmpty() || peer.latestState.get() != null)) drain(id, peer);
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException exception) { peer.sending.set(false); }
    }

    private void disconnect(String id, CloseStatus status) {
        var peer = peers.remove(id);
        if (peer == null) return;
        room.leave(peer.playerId);
        // 이미 끊긴 소켓의 close 실패와 관계없이 메모리 상태는 먼저 제거한다.
        try { if (peer.socket.isOpen()) peer.socket.close(status); } catch (IOException ignored) { }
        broadcast(Map.of("type", "left", "id", peer.playerId));
    }

    @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) { disconnect(session.getId(), status); }
    @Override public void handleTransportError(WebSocketSession session, Throwable exception) { disconnect(session.getId(), CloseStatus.SERVER_ERROR); }

    @PreDestroy
    public void stop() {
        peers.keySet().forEach(id -> disconnect(id, CloseStatus.GOING_AWAY));
        senders.shutdownNow();
    }
}
