package kr.seulgae.techlab.multiplayer.lobby.domain;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 클라이언트와 공유한 로비 데이터로 발밑 충돌과 맵 경계를 계산한다.
 *
 * @author seulgae
 * @version 1.0, 공유 방별 충돌·출입구·안전 스폰 로딩
 * @see "None"
 */
@Component
public class LobbyWorld {
    /**
     * 서버가 계산한 플레이어 발밑 기준 좌표이다.
     *
     * @param x 가로 좌표
     * @param y 발밑 세로 좌표
     * @author seulgae
     * @version 1.0, 검증된 이동 결과 좌표
     * @see "None"
     */
    public record Position(double x, double y) {}
    private record Area(double x, double y, double width, double height) {}
    /**
     * 방 안에서 E로 사용하는 상호작용 지점이다. 가장자리까지의 거리로 범위를 판정한다.
     *
     * @author seulgae
     * @version 1.0, 공유 맵의 방별 상호작용 정의
     * @see "None"
     */
    public record Interaction(String id, String kind, String label, double x, double y, double width, double height, double range) {
        /** 클라이언트 {@code isNearObject}와 같은 가장자리 거리 판정이다. */
        public boolean near(double px, double py) {
            double dx = Math.max(Math.abs(px - x) - width / 2, 0);
            double dy = Math.max(Math.abs(py - y) - height / 2, 0);
            return Math.hypot(dx, dy) <= range;
        }
    }
    private final Map<String, List<Interaction>> interactions = new LinkedHashMap<>();
    /**
     * 앉을 수 있는 의자. 공유 맵의 chair 가구에서 방별 순서대로 만든다(예: meeting-room-chair-0).
     *
     * @author seulgae
     * @version 1.0, 의자 앉기 검증
     * @see "None"
     */
    public record Seat(String id, double x, double y, double width, double height) {
        public static final double RANGE = 40;
        public boolean near(double px, double py) {
            double dx = Math.max(Math.abs(px - x) - width / 2, 0);
            double dy = Math.max(Math.abs(py - y) - height / 2, 0);
            return Math.hypot(dx, dy) <= RANGE;
        }
    }
    private final Map<String, List<Seat>> seats = new LinkedHashMap<>();
    private final List<Area> obstacles = new ArrayList<>();
    private final double width;
    private final double height;
    private final double halfWidth;
    private final double footHeight;
    private final List<Position> spawns = new ArrayList<>();
    private JsonNode rooms;

    public LobbyWorld() {
        try (var stream = getClass().getResourceAsStream("/shared/lobby-world.json")) {
            if (stream == null) throw new IllegalStateException("Missing shared lobby geometry");
            var data = JsonMapper.builder().build().readTree(stream);
            rooms = data.get("rooms");
            width = data.get("world").get("width").asDouble();
            height = data.get("world").get("height").asDouble();
            halfWidth = data.get("player").get("halfWidth").asDouble();
            footHeight = data.get("player").get("height").asDouble();
            data.get("spawns").forEach(node -> spawns.add(new Position(node.get("x").asDouble(), node.get("y").asDouble())));
            data.get("walls").forEach(node -> obstacles.add(area(node)));
            data.get("objects").forEach(node -> obstacles.add(area(node.get("body"))));
            for (var entry : rooms.properties()) {
                var list = new ArrayList<Interaction>();
                var nodes = entry.getValue().get("interactions");
                if (nodes != null) nodes.forEach(node -> list.add(new Interaction(node.get("id").stringValue(), node.get("kind").stringValue(),
                    node.get("label").stringValue(), node.get("x").asDouble(), node.get("y").asDouble(),
                    node.get("width").asDouble(), node.get("height").asDouble(), node.get("range").asDouble())));
                interactions.put(entry.getKey(), List.copyOf(list));
                // 로비 가구는 최상위 objects, 나머지 방은 rooms.<id>.objects에 있다.
                var objects = entry.getKey().equals("lobby") ? data.get("objects") : entry.getValue().get("objects");
                var roomSeats = new ArrayList<Seat>();
                if (objects != null) for (var object : objects) {
                    if (!"chair".equals(object.path("texture").stringValue(""))) continue;
                    var body = object.get("body");
                    roomSeats.add(new Seat(entry.getKey() + "-chair-" + roomSeats.size(), body.get("x").asDouble(), body.get("y").asDouble(),
                        body.get("width").asDouble(), body.get("height").asDouble()));
                }
                seats.put(entry.getKey(), List.copyOf(roomSeats));
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot load lobby geometry", exception);
        }
    }

    private static Area area(JsonNode node) {
        return new Area(node.get("x").asDouble(), node.get("y").asDouble(), node.get("width").asDouble(), node.get("height").asDouble());
    }

    /**
     * 공통 맵에서 지정한 빈 스폰 슬롯의 위치를 반환한다.
     *
     * @param slot 0~4의 스폰 슬롯
     * @return 초기 발밑 좌표
     */
    public Position spawn(int slot) { return spawns.get(slot); }

    /**
     * 축별로 장애물 접촉 위치를 제한해 벽을 통과하지 않고 미끄러져 이동한다.
     *
     * @param x 현재 발밑 기준 X
     * @param y 현재 발밑 기준 Y
     * @param dx 서버가 계산한 X 이동량
     * @param dy 서버가 계산한 Y 이동량
     * @return 충돌과 경계를 반영한 위치
     */
    public Position move(double x, double y, double dx, double dy) {
        return moveIn("lobby", x, y, dx, dy);
    }

    /** 방별 공유 가구 배치로 동일한 축별 충돌 계산을 수행한다. */
    public Position moveIn(String roomId, double x, double y, double dx, double dy) {
        var obstacles = new ArrayList<Area>();
        if (roomId.equals("lobby")) obstacles.addAll(this.obstacles);
        else {
            obstacles.addAll(this.obstacles.subList(0, 4));
            rooms.get(roomId).get("objects").forEach(node -> obstacles.add(area(node.get("body"))));
        }
        double nextX = Math.max(halfWidth, Math.min(width - halfWidth, x + dx));
        for (var a : obstacles) {
            if (y <= a.y - a.height / 2 || y - footHeight >= a.y + a.height / 2) continue;
            double left = a.x - a.width / 2, right = a.x + a.width / 2;
            if (dx > 0 && x + halfWidth <= left && nextX + halfWidth > left) nextX = Math.min(nextX, left - halfWidth);
            if (dx < 0 && x - halfWidth >= right && nextX - halfWidth < right) nextX = Math.max(nextX, right + halfWidth);
        }
        double nextY = Math.max(footHeight, Math.min(height, y + dy));
        for (var a : obstacles) {
            if (nextX + halfWidth <= a.x - a.width / 2 || nextX - halfWidth >= a.x + a.width / 2) continue;
            double top = a.y - a.height / 2, bottom = a.y + a.height / 2;
            if (dy > 0 && y <= top && nextY > top) nextY = Math.min(nextY, top);
            if (dy < 0 && y - footHeight >= bottom && nextY - footHeight < bottom) nextY = Math.max(nextY, bottom + footHeight);
        }
        return new Position(nextX, nextY);
    }

    /** 현재 방의 출입구와 서버 좌표를 검증하고 연결된 목적지만 반환한다. */
    public String destination(String roomId, String doorId, double x, double y) {
        for (var door : rooms.get(roomId).get("doors")) {
            if (door.get("id").stringValue().equals(doorId)
                    && Math.hypot(x - door.get("x").asDouble(), y - door.get("y").asDouble()) <= 56) {
                return door.get("target").stringValue();
            }
        }
        throw new IllegalArgumentException("Door unavailable");
    }

    /** 목적지 방의 가구 밖 안전 지점을 사용한다. */
    public Position roomSpawn(String roomId) {
        var spawn = rooms.get(roomId).get("spawn");
        return new Position(spawn.get("x").asDouble(), spawn.get("y").asDouble());
    }

    /** @return 공유 맵에 정의된 방 식별자, 정의 순서 유지 */
    public List<String> roomIds() { return List.copyOf(interactions.keySet()); }

    /** @return 방의 표시 이름 */
    public String roomName(String roomId) { return rooms.get(roomId).get("name").stringValue(); }

    /** @return 방의 상호작용 지점 목록, 없는 방이면 빈 목록 */
    public List<Interaction> interactions(String roomId) { return interactions.getOrDefault(roomId, List.of()); }

    /** @return 방의 의자 목록, 없는 방이면 빈 목록 */
    public List<Seat> seats(String roomId) { return seats.getOrDefault(roomId, List.of()); }

    /** 서버 좌표가 현재 방의 해당 의자 가까이에 있는지 확인한다. */
    public boolean nearSeat(String roomId, String seatId, double x, double y) {
        return seats(roomId).stream().anyMatch(seat -> seat.id().equals(seatId) && seat.near(x, y));
    }

    /** 서버 좌표가 해당 방의 지정 종류 상호작용 범위 안에 있는지 확인한다. */
    public boolean near(String roomId, String kind, double x, double y) {
        return interactions(roomId).stream().anyMatch(interaction -> interaction.kind().equals(kind) && interaction.near(x, y));
    }
}
