package kr.seulgae.techlab.usemap.domain;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

/**
 * 협동 연구실 유즈맵 대기실: 접속한 연구원, 방(이름·맵·인원·비밀번호·방장·준비), 게임 시작·끝.
 * 메모리에만 두며(서버를 다시 켜면 사라진다) 판정은 하지 않는다. 게임 중 판정은 방장 브라우저의 맵이 한다.
 * 모든 메서드는 한 번에 하나만 실행된다(synchronized). 잘못된 요청은 IllegalArgumentException(사용자에게 보일 문구)으로 거절한다.
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 * @see None
 */
@Component
public class UseMapLobby {
    public static final int MAX_ROOMS = 50, MAX_PLAYERS = 8, NAME_MAX = 20, PASSWORD_MAX = 20;

    /** 접속한 연구원 */
    public record Player(String id, String nickname) {}

    /** 방(화면에 보낼 모양). password는 보내지 않고 locked로만 알린다. */
    public record RoomView(String id, String name, String mapId, int maxPlayers, boolean locked, String hostId, List<Player> players, Set<String> ready,
                           boolean playing) {}

    private static final class Room {
        final String id; String name; String mapId; int maxPlayers; String password; String hostId; boolean playing; long seed;
        final List<String> players = new ArrayList<>();
        final Set<String> ready = new LinkedHashSet<>();
        Room(String id) { this.id = id; }
    }

    private final UseMapCatalog catalog;
    private final Map<String, Player> players = new LinkedHashMap<>();
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final Map<String, String> roomOf = new LinkedHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final SecureRandom random = new SecureRandom();

    public UseMapLobby(UseMapCatalog catalog) { this.catalog = catalog; }

    /**
     * 대기실에 들어온다.
     *
     * @param id 연결 id
     * @param nickname 닉네임
     */
    public synchronized void connect(String id, String nickname) { players.put(id, new Player(id, nickname)); }

    /**
     * 연결이 끊겼다: 방에서도 나간다.
     *
     * @param id 연결 id
     * @return 영향받은 방 id(없으면 빈 값)
     */
    public synchronized Optional<String> disconnect(String id) {
        Optional<String> left = exit(id);
        players.remove(id);
        return left;
    }

    /** @return 대기실 방 목록(최근 만든 방이 위) */
    public synchronized List<RoomView> rooms() {
        var list = new ArrayList<>(rooms.values().stream().map(this::view).toList());
        java.util.Collections.reverse(list);
        return list;
    }

    /**
     * 방 하나.
     *
     * @param roomId 방 id
     * @return 방(없으면 빈 값)
     */
    public synchronized Optional<RoomView> room(String roomId) { return Optional.ofNullable(rooms.get(roomId)).map(this::view); }

    /**
     * 내가 있는 방.
     *
     * @param id 연결 id
     * @return 방 id(없으면 빈 값)
     */
    public synchronized Optional<String> roomOf(String id) { return Optional.ofNullable(roomOf.get(id)); }

    /**
     * 방에 있는 연결 id들.
     *
     * @param roomId 방 id
     * @return 연결 id 목록
     */
    public synchronized List<String> members(String roomId) { return Optional.ofNullable(rooms.get(roomId)).map(room -> List.copyOf(room.players)).orElse(List.of()); }

    /** @param id 연결 id @return 닉네임(없으면 빈 값) */
    public synchronized Optional<String> nickname(String id) { return Optional.ofNullable(players.get(id)).map(Player::nickname); }

    /**
     * 방을 만들고 방장으로 들어간다.
     *
     * @param id 연결 id
     * @param name 방 이름(1~20자)
     * @param mapId 맵
     * @param maxPlayers 최대 인원(2~8, 맵 범위 안)
     * @param password 비밀번호(없으면 빈 문자열)
     * @return 새 방 id
     */
    public synchronized String create(String id, String name, String mapId, int maxPlayers, String password) {
        requireConnected(id);
        if (roomOf.containsKey(id)) throw new IllegalArgumentException("이미 방에 들어가 있어요.");
        if (rooms.size() >= MAX_ROOMS) throw new IllegalArgumentException("방이 너무 많아요. 다른 방에 들어가 주세요.");
        String trimmed = name == null ? "" : name.strip();
        if (trimmed.isEmpty() || trimmed.codePointCount(0, trimmed.length()) > NAME_MAX) throw new IllegalArgumentException("방 이름은 1~20자예요.");
        var map = catalog.find(mapId).orElseThrow(() -> new IllegalArgumentException("없는 맵이에요."));
        if (maxPlayers < Math.max(2, map.minPlayers()) || maxPlayers > Math.min(MAX_PLAYERS, map.maxPlayers())) throw new IllegalArgumentException("인원은 2~" + Math.min(MAX_PLAYERS, map.maxPlayers()) + "명이에요.");
        String pass = password == null ? "" : password.strip();
        if (pass.length() > PASSWORD_MAX) throw new IllegalArgumentException("비밀번호는 20자까지예요.");
        var room = new Room("r" + sequence.incrementAndGet());
        room.name = trimmed; room.mapId = map.id(); room.maxPlayers = maxPlayers; room.password = pass; room.hostId = id;
        room.players.add(id);
        rooms.put(room.id, room);
        roomOf.put(id, room.id);
        return room.id;
    }

    /**
     * 방에 들어간다.
     *
     * @param id 연결 id
     * @param roomId 방 id
     * @param password 비밀번호
     */
    public synchronized void enter(String id, String roomId, String password) {
        requireConnected(id);
        if (roomOf.containsKey(id)) throw new IllegalArgumentException("이미 방에 들어가 있어요.");
        Room room = rooms.get(roomId);
        if (room == null) throw new IllegalArgumentException("없어진 방이에요.");
        if (room.playing) throw new IllegalArgumentException("게임이 진행 중인 방이에요.");
        if (room.players.size() >= room.maxPlayers) throw new IllegalArgumentException("방이 가득 찼어요.");
        if (!room.password.isEmpty() && !room.password.equals(password == null ? "" : password.strip())) throw new IllegalArgumentException("비밀번호가 달라요.");
        room.players.add(id);
        roomOf.put(id, roomId);
    }

    /**
     * 방에서 나간다. 방장이 나가면 다음 사람이 방장, 아무도 없으면 방을 지운다.
     *
     * @param id 연결 id
     * @return 나간 방 id(방에 없었으면 빈 값)
     */
    public synchronized Optional<String> exit(String id) {
        String roomId = roomOf.remove(id);
        if (roomId == null) return Optional.empty();
        Room room = rooms.get(roomId);
        room.players.remove(id);
        room.ready.remove(id);
        if (room.players.isEmpty()) { rooms.remove(roomId); return Optional.of(roomId); }
        if (room.hostId.equals(id)) { room.hostId = room.players.get(0); room.ready.remove(room.hostId); }
        return Optional.of(roomId);
    }

    /**
     * 준비 표시를 바꾼다(방장은 준비가 필요 없다).
     *
     * @param id 연결 id
     * @param ready 준비 여부
     * @return 방 id
     */
    public synchronized String ready(String id, boolean ready) {
        Room room = myRoom(id);
        if (room.playing) throw new IllegalArgumentException("게임이 진행 중이에요.");
        if (room.hostId.equals(id)) return room.id;
        if (ready) room.ready.add(id); else room.ready.remove(id);
        return room.id;
    }

    /**
     * 방장이 맵을 바꾼다. 준비 표시는 모두 풀린다.
     *
     * @param id 연결 id
     * @param mapId 맵
     * @return 방 id
     */
    public synchronized String chooseMap(String id, String mapId) {
        Room room = hostRoom(id);
        if (room.playing) throw new IllegalArgumentException("게임이 진행 중이에요.");
        var map = catalog.find(mapId).orElseThrow(() -> new IllegalArgumentException("없는 맵이에요."));
        if (room.players.size() > map.maxPlayers()) throw new IllegalArgumentException("이 맵은 " + map.maxPlayers() + "명까지예요.");
        room.mapId = map.id();
        room.ready.clear();
        return room.id;
    }

    /**
     * 방장이 게임을 시작한다: 맵 최소 인원 이상이고 방장 말고 모두 준비해야 한다.
     *
     * @param id 연결 id
     * @return 시작 정보(방 id, 맵 id, 방장, 참가자, 난수 씨앗)
     */
    public synchronized Start start(String id) {
        Room room = hostRoom(id);
        if (room.playing) throw new IllegalArgumentException("이미 진행 중이에요.");
        var map = catalog.find(room.mapId).orElseThrow(() -> new IllegalArgumentException("없는 맵이에요."));
        if (room.players.size() < map.minPlayers()) throw new IllegalArgumentException("이 맵은 " + map.minPlayers() + "명부터 할 수 있어요.");
        if (!room.players.stream().filter(player -> !player.equals(room.hostId)).allMatch(room.ready::contains)) throw new IllegalArgumentException("모두 준비해야 시작할 수 있어요.");
        room.playing = true;
        room.seed = random.nextInt(1_000_000_000);
        return new Start(room.id, room.mapId, room.hostId, room.players.stream().map(players::get).toList(), room.seed);
    }

    /** 게임 시작 정보 */
    public record Start(String roomId, String mapId, String hostId, List<Player> players, long seed) {}

    /**
     * 게임이 끝났다(방장 맵이 보고). 대기 상태로 돌아가고 준비 표시가 풀린다.
     *
     * @param id 연결 id
     * @return 방 id
     */
    public synchronized String end(String id) {
        Room room = hostRoom(id);
        room.playing = false;
        room.ready.clear();
        return room.id;
    }

    /**
     * 게임 메시지를 받을 사람들: 진행 중인 내 방의 다른 사람.
     *
     * @param id 보낸 연결 id
     * @return 받을 연결 id(진행 중이 아니면 빈 목록)
     */
    public synchronized List<String> relayTargets(String id) {
        String roomId = roomOf.get(id);
        Room room = roomId == null ? null : rooms.get(roomId);
        if (room == null || !room.playing) return List.of();
        return room.players.stream().filter(player -> !player.equals(id)).toList();
    }

    private Room myRoom(String id) {
        String roomId = roomOf.get(id);
        if (roomId == null) throw new IllegalArgumentException("방에 들어가 있지 않아요.");
        return rooms.get(roomId);
    }

    private Room hostRoom(String id) {
        Room room = myRoom(id);
        if (!room.hostId.equals(id)) throw new IllegalArgumentException("방장만 할 수 있어요.");
        return room;
    }

    private void requireConnected(String id) { if (!players.containsKey(id)) throw new IllegalArgumentException("다시 접속해 주세요."); }

    private RoomView view(Room room) {
        return new RoomView(room.id, room.name, room.mapId, room.maxPlayers, !room.password.isEmpty(), room.hostId,
            room.players.stream().map(players::get).toList(), Set.copyOf(room.ready), room.playing);
    }
}
