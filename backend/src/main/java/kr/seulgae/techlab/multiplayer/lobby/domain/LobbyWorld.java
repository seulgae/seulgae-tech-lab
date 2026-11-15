package kr.seulgae.techlab.multiplayer.lobby.domain;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 클라이언트와 공유한 로비 데이터로 발밑 충돌과 맵 경계를 계산한다.
 *
 * @author seulgae
 * @version 1.0, 서버 기준 이동 및 공통 맵 로딩
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
    private final List<Area> obstacles = new ArrayList<>();
    private final double width;
    private final double height;
    private final double halfWidth;
    private final double footHeight;
    private final List<Position> spawns = new ArrayList<>();

    public LobbyWorld() {
        try (var stream = getClass().getResourceAsStream("/shared/lobby-world.json")) {
            if (stream == null) throw new IllegalStateException("Missing shared lobby geometry");
            var data = JsonMapper.builder().build().readTree(stream);
            width = data.get("world").get("width").asDouble();
            height = data.get("world").get("height").asDouble();
            halfWidth = data.get("player").get("halfWidth").asDouble();
            footHeight = data.get("player").get("height").asDouble();
            data.get("spawns").forEach(node -> spawns.add(new Position(node.get("x").asDouble(), node.get("y").asDouble())));
            data.get("walls").forEach(node -> obstacles.add(area(node)));
            data.get("objects").forEach(node -> obstacles.add(area(node.get("body"))));
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
}
