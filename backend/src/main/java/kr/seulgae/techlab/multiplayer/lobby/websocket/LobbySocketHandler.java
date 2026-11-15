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
 * @version 1.0, 입력 검증·속도 제한·접속 정리 및 상태 방송
 * @see "None"
 */
@Component
public class LobbySocketHandler extends TextWebSocketHandler {
    private static final Logger LOG = LoggerFactory.getLogger(LobbySocketHandler.class);
    private static final Set<String> INPUT_FIELDS = Set.of("type", "x", "y", "seq");
    private static final Set<String> CHAT_FIELDS = Set.of("type", "message");
    private static final double INPUTS_PER_SECOND = 40;
    private static final double INPUT_BURST_CAPACITY = 80;
    /**
     * 연결별 송신 큐와 입력 제한·진단 정보를 보관한다.
     * @author seulgae
     * @version 1.0, 로비 연결 수명과 제한 상태
     * @see "None"
     */
    private static final class Peer {
        final WebSocketSession socket;
        final String playerId;
        final AtomicBoolean sending = new AtomicBoolean();
        final ArrayBlockingQueue<WebSocketMessage<?>> controls = new ArrayBlockingQueue<>(16);
        final AtomicReference<WebSocketMessage<?>> latestState = new AtomicReference<>();
        final AtomicReference<CloseStatus> closing = new AtomicReference<>();
        volatile long lastSeen = System.nanoTime(), lastPing = lastSeen;
        final long connectedAt = System.nanoTime();
        long replenishedAt = connectedAt, receivedInputs;
        long ignoredInputs;
        double inputTokens = INPUT_BURST_CAPACITY;
        Peer(WebSocketSession socket, String playerId) { this.socket = socket; this.playerId = playerId; }
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
    private long lastTick = System.nanoTime(), tick;

    public LobbySocketHandler(LobbyRoom room, LobbyChat chat) { this.room = room; this.chat = chat; }

    /** 검증된 임시 이름으로 접속시키고 본인 ID와 전체 스냅샷을 먼저 전송한다. */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.setTextMessageSizeLimit(1024);
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
        var socket = new ConcurrentWebSocketSessionDecorator(session, 1000, 65536);
        try {
            // 입장 기록과 실시간 방송 사이에 메시지가 빠지지 않게 같은 채팅 잠금을 사용한다.
            synchronized (chat) {
                var peer = new Peer(socket, player.id());
                peer.controls.add(new TextMessage(json.writeValueAsString(Map.of("type", "welcome", "selfId", player.id(), "players", room.snapshot(), "maxPlayers", LobbyRoom.MAX_PLAYERS, "protocolVersion", 3))));
                peer.controls.add(new TextMessage(json.writeValueAsString(Map.of("type", "chat_history", "messages", chat.history()))));
                peers.put(session.getId(), peer);
                drain(session.getId(), peer);
            }
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
        int payloadBytes = message.getPayload().getBytes(StandardCharsets.UTF_8).length;
        if (payloadBytes > 1024) {
            disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return;
        }
        String rejection = "Invalid input: JSON";
        try {
            var input = json.readTree(message.getPayload());
            if (input.isObject() && input.path("type").stringValue("").equals("chat")) {
                try {
                    synchronized (chat) {
                        if (peers.get(session.getId()) != peer) return;
                        // 부정한 필드 요청도 채팅 제한을 소비하게 해 반복 오류 방송을 막는다.
                        String text = Set.copyOf(input.propertyNames()).equals(CHAT_FIELDS) && input.get("message").isString()
                            ? input.get("message").stringValue() : null;
                        broadcast(chat.post(peer.playerId, text, now));
                    }
                } catch (LobbyChat.Rejected exception) {
                    dispatch(session.getId(), peer, new TextMessage(json.writeValueAsString(Map.of("type", "chat_error", "reason", exception.getMessage()))), true);
                }
                peer.lastSeen = now;
                return;
            }
            if (payloadBytes > 512) { disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return; }
            if (!peer.allow(now)) {
                LOG.warn("Lobby input rate exceeded: player={}, receivedInputs={}, connectedMs={}",
                    peer.playerId, peer.receivedInputs, (now - peer.connectedAt) / 1_000_000);
                disconnect(session.getId(), CloseStatus.POLICY_VIOLATION.withReason("Input rate exceeded")); return;
            }
            rejection = "Invalid input: fields";
            if (!input.isObject() || !Set.copyOf(input.propertyNames()).equals(INPUT_FIELDS)
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
            if (payloadBytes > 512) { disconnect(session.getId(), CloseStatus.TOO_BIG_TO_PROCESS); return; }
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
        boolean reliable = !(payload instanceof Map<?, ?> map && "state".equals(map.get("type")));
        peers.forEach((id, peer) -> dispatch(id, peer, message, reliable));
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

    private void disconnect(String id, CloseStatus status) {
        var peer = peers.remove(id);
        if (peer == null) return;
        LOG.info("Lobby connection closed: player={}, code={}, reason={}, receivedInputs={}, connectedMs={}",
            peer.playerId, status.getCode(), status.getReason(), peer.receivedInputs,
            (System.nanoTime() - peer.connectedAt) / 1_000_000);
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
        broadcast(Map.of("type", "left", "id", peer.playerId));
    }

    @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) { disconnect(session.getId(), status); }
    @Override public void handleTransportError(WebSocketSession session, Throwable exception) { disconnect(session.getId(), CloseStatus.SERVER_ERROR); }

    @PreDestroy
    public void stop() {
        peers.keySet().forEach(id -> disconnect(id, CloseStatus.GOING_AWAY));
        senders.shutdown();
    }
}
