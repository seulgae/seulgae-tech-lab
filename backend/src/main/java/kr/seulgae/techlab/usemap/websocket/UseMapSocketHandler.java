package kr.seulgae.techlab.usemap.websocket;

import java.io.IOException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.multiplayer.lobby.websocket.LobbySocketHandler;
import kr.seulgae.techlab.usemap.domain.UseMapCatalog;
import kr.seulgae.techlab.usemap.domain.UseMapLobby;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 협동 연구실 유즈맵 대기실 WebSocket(/ws/usemap).
 * 받는 메시지(t): ping, chat(scope lobby|room, text), create(name, mapId, max, password), join(roomId, password), leave, ready(ready),
 * map(mapId), start, game(data: 맵이 정한 값, 같은 방 다른 사람에게 그대로 전달), end(result).
 * 보내는 메시지(t): welcome, rooms, room, left, chat, start, game, end, error.
 * 서버는 방·채팅·중계만 하고 게임 판정은 하지 않는다(방장 브라우저의 맵이 판정).
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 * @see None
 */
@Component
public class UseMapSocketHandler extends TextWebSocketHandler {
    private static final Logger LOG = LoggerFactory.getLogger(UseMapSocketHandler.class);
    /** 대화는 0.7초에 한 번, 게임 메시지는 1초에 40개까지(넘치면 버린다) */
    static final long CHAT_GAP_MS = 700;
    static final int GAME_PER_SECOND = 40, CHAT_MAX = 100, MAX_CONNECTIONS = 200;

    private final UseMapLobby lobby;
    private final UseMapCatalog catalog;
    private final InventoryRepository inventory;
    private final JsonMapper json = JsonMapper.builder().build();
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();

    /** 연결 하나: 보내기 장치와 도배 방지 시각 */
    private static final class Peer {
        final WebSocketSession socket; long lastChat; long windowStart; int windowCount;
        Peer(WebSocketSession socket) { this.socket = socket; }
    }

    public UseMapSocketHandler(UseMapLobby lobby, UseMapCatalog catalog, InventoryRepository inventory) {
        this.lobby = lobby; this.catalog = catalog; this.inventory = inventory;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        if (peers.size() >= MAX_CONNECTIONS) { session.close(new CloseStatus(1013, "Too many")); return; }
        String nickname = nickname(session);
        var peer = new Peer(new ConcurrentWebSocketSessionDecorator(session, 5000, 64 * 1024));
        peers.put(session.getId(), peer);
        lobby.connect(session.getId(), nickname);
        send(peer, Map.of("t", "welcome", "you", Map.of("id", session.getId(), "nickname", nickname), "maps", catalog.maps()));
        send(peer, Map.of("t", "rooms", "rooms", lobby.rooms()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        peers.remove(session.getId());
        lobby.disconnect(session.getId()).ifPresent(this::roomChanged);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        var peer = peers.get(session.getId());
        if (peer == null) return;
        String id = session.getId();
        try {
            JsonNode input = json.readTree(message.getPayload());
            String type = input.path("t").stringValue("");
            switch (type) {
                case "ping" -> { }
                case "chat" -> chat(peer, id, input);
                case "create" -> {
                    String roomId = lobby.create(id, input.path("name").stringValue(""), input.path("mapId").stringValue(""), input.path("max").asInt(4), input.path("password").stringValue(""));
                    roomChanged(roomId);
                }
                case "join" -> { String roomId = input.path("roomId").stringValue(""); lobby.enter(id, roomId, input.path("password").stringValue("")); roomChanged(roomId); }
                case "leave" -> { lobby.exit(id).ifPresent(this::roomChanged); send(peer, Map.of("t", "left")); }
                case "ready" -> roomChanged(lobby.ready(id, input.path("ready").asBoolean(false)));
                case "map" -> roomChanged(lobby.chooseMap(id, input.path("mapId").stringValue("")));
                case "start" -> {
                    var start = lobby.start(id);
                    broadcast(lobby.members(start.roomId()), Map.of("t", "start", "roomId", start.roomId(), "mapId", start.mapId(), "hostId", start.hostId(),
                        "players", start.players(), "seed", start.seed()));
                    roomChanged(start.roomId());
                }
                case "game" -> relay(peer, id, input.path("data"));
                case "end" -> {
                    String roomId = lobby.end(id);
                    var payload = new LinkedHashMap<String, Object>();
                    payload.put("t", "end");
                    payload.put("result", input.path("result").isObject() ? input.path("result") : Map.of());
                    broadcast(lobby.members(roomId), payload);
                    roomChanged(roomId);
                }
                default -> send(peer, Map.of("t", "error", "message", "알 수 없는 요청이에요."));
            }
        } catch (IllegalArgumentException exception) {
            send(peer, Map.of("t", "error", "message", exception.getMessage()));
        } catch (RuntimeException exception) {
            LOG.debug("Bad usemap message from {}", id, exception);
            send(peer, Map.of("t", "error", "message", "요청을 처리하지 못했어요."));
        }
    }

    /**
     * 대화: 대기실 전체 또는 내 방. 0.7초에 한 번, 1~100자.
     */
    private void chat(Peer peer, String id, JsonNode input) {
        String text = input.path("text").stringValue("").strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > CHAT_MAX) throw new IllegalArgumentException("대화는 1~100자예요.");
        long now = System.currentTimeMillis();
        if (now - peer.lastChat < CHAT_GAP_MS) throw new IllegalArgumentException("조금 천천히 말해 주세요.");
        peer.lastChat = now;
        boolean room = "room".equals(input.path("scope").stringValue("lobby"));
        var payload = Map.of("t", "chat", "scope", room ? "room" : "lobby", "from", lobby.nickname(id).orElse("연구원"), "text", text, "at", now);
        if (room) broadcast(lobby.roomOf(id).map(lobby::members).orElseThrow(() -> new IllegalArgumentException("방에 들어가 있지 않아요.")), payload);
        else broadcast(peers.keySet(), payload);
    }

    /** 게임 메시지 중계: 진행 중인 내 방의 다른 사람에게(1초에 40개까지, 넘치면 버림) */
    private void relay(Peer peer, String id, JsonNode data) {
        long now = System.currentTimeMillis();
        if (now - peer.windowStart >= 1000) { peer.windowStart = now; peer.windowCount = 0; }
        if (++peer.windowCount > GAME_PER_SECOND) return;
        var payload = new LinkedHashMap<String, Object>();
        payload.put("t", "game");
        payload.put("from", id);
        payload.put("data", data);
        broadcast(lobby.relayTargets(id), payload);
    }

    /** 방이 바뀌면: 방 사람들에게 방 모양, 모두에게 방 목록 */
    private void roomChanged(String roomId) {
        lobby.room(roomId).ifPresent(room -> broadcast(lobby.members(roomId), Map.of("t", "room", "room", room)));
        broadcast(peers.keySet(), Map.of("t", "rooms", "rooms", lobby.rooms()));
    }

    private void broadcast(Collection<String> ids, Object payload) {
        String text;
        try { text = json.writeValueAsString(payload); } catch (RuntimeException exception) { return; }
        for (String target : List.copyOf(ids)) {
            var peer = peers.get(target);
            if (peer != null) sendText(peer, text);
        }
    }

    private void send(Peer peer, Object payload) {
        try { sendText(peer, json.writeValueAsString(payload)); } catch (RuntimeException ignored) { /* 보내기 실패는 연결 종료로 정리된다 */ }
    }

    private void sendText(Peer peer, String text) {
        try { if (peer.socket.isOpen()) peer.socket.sendMessage(new TextMessage(text)); }
        catch (IOException | IllegalStateException exception) { LOG.debug("usemap send failed", exception); }
    }

    /**
     * 닉네임: 로그인 회원이면 회원 닉네임, 아니면 "손님 ab12".
     *
     * @param session 연결
     * @return 닉네임
     */
    private String nickname(WebSocketSession session) {
        Object member = session.getAttributes().get(LobbySocketHandler.MEMBER_ID);
        if (member instanceof UUID id) {
            try { return inventory.nickname(id).orElse("연구원"); } catch (RuntimeException ignored) { return "연구원"; }
        }
        return "손님 " + session.getId().replace("-", "").substring(0, 4);
    }
}
