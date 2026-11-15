package kr.seulgae.techlab.multiplayer.lobby.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * 최대 5명의 임시 방문자와 서버 기준 이동 상태를 메모리에서 관리한다.
 *
 * @author seulgae
 * @version 1.0, 단일 로비의 접속·입력·이동 상태 관리
 * @see "None"
 */
@Component
public class LobbyRoom {
    public static final int MAX_PLAYERS = 5;
    public static final int GREET_RANGE = 80;
    public static final int GREET_DURATION_MS = 3000;
    /**
     * 서버가 검증한 고정 인사 이벤트이다. 자유 입력 메시지는 받지 않는다.
     * @author seulgae
     * @version 1.0, 인사 방송 데이터
     * @see "None"
     */
    public record Greeting(String type, String eventId, String playerId, String targetPlayerId, String message, int durationMs) {}
    /**
     * 스냅샷에 포함할 서버 기준 플레이어 상태이다.
     *
     * @author seulgae
     * @version 1.0, 위치·방향·이동 및 수신 입력 번호 전달
     * @see "None"
     */
    public record PlayerView(String id, String nickname, double x, double y, String facing, boolean moving, long ack) {}
    /**
     * 서버 내부에서만 수정하는 방문자의 입력·위치·인사 쿨다운 상태이다.
     * @author seulgae
     * @version 1.0, 단일 방문자 상태 관리
     * @see "None"
     */
    private static final class Member {
        String id, nickname, facing = "down";
        double x, y;
        int inputX, inputY;
        long sequence = -1, inputAt;
        long lastGreeting = Long.MIN_VALUE;
        boolean moving;
        PlayerView view() { return new PlayerView(id, nickname, x, y, facing, moving, sequence); }
    }
    private final LinkedHashMap<String, Member> members = new LinkedHashMap<>();
    private final LobbyWorld world;
    public LobbyRoom(LobbyWorld world) { this.world = world; }

    /**
     * 고유 식별자와 검증된 임시 이름으로 방문자를 생성한다.
     *
     * @param requestedName 선택적인 임시 이름
     * @return 생성된 방문자
     * @throws IllegalArgumentException 이름이 유효하지 않은 경우
     * @throws IllegalStateException 로비가 가득 찬 경우
     */
    public synchronized PlayerView join(String requestedName) {
        if (members.size() >= MAX_PLAYERS) throw new IllegalStateException("Lobby full");
        String id = UUID.randomUUID().toString();
        String name = requestedName == null ? "연구원-" + id.substring(0, 4) : requestedName;
        if (!name.matches("[\\p{L}\\p{N}_-]{1,16}")) throw new IllegalArgumentException("Invalid nickname");
        final String candidate = name;
        if (members.values().stream().anyMatch(member -> member.nickname.equals(candidate))) {
            name = name.substring(0, Math.min(name.length(), 11)) + "-" + id.substring(0, 4);
        }
        var member = new Member();
        member.id = id; member.nickname = name;
        // 퇴장 후 빈 슬롯도 재사용해 스폰 위치가 가구로 밀려가지 않도록 한다.
        int slot = 0;
        while (slot < MAX_PLAYERS) {
            var position = world.spawn(slot);
            if (members.values().stream().noneMatch(other -> Math.hypot(other.x - position.x(), other.y - position.y()) < 24)) break;
            slot++;
        }
        var spawn = world.spawn(Math.min(slot, MAX_PLAYERS - 1));
        member.x = spawn.x(); member.y = spawn.y();
        members.put(id, member);
        return member.view();
    }

    /**
     * 좌표·시간 대신 정수 방향과 증가하는 입력 번호만 받아 재전송을 거부한다.
     *
     * @param id 서버가 발급한 방문자 식별자
     * @param x -1, 0, 1 중 하나인 가로 방향
     * @param y -1, 0, 1 중 하나인 세로 방향
     * @param sequence 연결 내에서 증가하는 입력 번호
     * @param now 수신 시점의 서버 단조 시각, 나노초
     * @return 입력을 적용했다면 true
     */
    public synchronized boolean input(String id, int x, int y, long sequence, long now) {
        var member = members.get(id);
        if (member == null || x < -1 || x > 1 || y < -1 || y > 1 || sequence < 0 || sequence <= member.sequence || sequence > 9_007_199_254_740_991L) return false;
        member.inputX = x; member.inputY = y; member.sequence = sequence; member.inputAt = now;
        return true;
    }

    /**
     * 서버 시계만 사용하며 입력이 300ms 이상 끊기면 정지 상태로 전환한다.
     *
     * @param seconds 이전 서버 갱신 이후의 초 단위 경과 시간
     * @param now 현재 서버 단조 시각, 나노초
     */
    public synchronized void step(double seconds, long now) {
        double elapsed = Math.max(0, Math.min(0.1, seconds));
        for (var member : members.values()) {
            int x = now - member.inputAt <= 300_000_000L ? member.inputX : 0;
            int y = now - member.inputAt <= 300_000_000L ? member.inputY : 0;
            if (y != 0) member.facing = y < 0 ? "up" : "down";
            else if (x != 0) member.facing = x < 0 ? "left" : "right";
            double length = Math.hypot(x, y);
            var position = world.move(member.x, member.y, length == 0 ? 0 : x / length * 200 * elapsed, length == 0 ? 0 : y / length * 200 * elapsed);
            member.moving = Math.hypot(position.x() - member.x, position.y() - member.y) > 0.001;
            member.x = position.x(); member.y = position.y();
        }
    }

    /** @return 내부 가변 객체를 노출하지 않는 현재 접속자 상태 목록 */
    public synchronized List<PlayerView> snapshot() { return members.values().stream().map(Member::view).toList(); }

    /**
     * 같은 로비의 가까운 상대에게만 3초 간격으로 고정 인사를 허용한다.
     * @param id 요청 세션의 플레이어 ID
     * @param targetId 대상 플레이어 ID
     * @param now 서버 단조 시각
     * @return 유효한 인사 또는 거절 시 null
     */
    public synchronized Greeting greet(String id, String targetId, long now) {
        var sender = members.get(id);
        var target = members.get(targetId);
        if (sender == null || target == null || id.equals(targetId)
            || Math.hypot(sender.x - target.x, sender.y - target.y) > GREET_RANGE
            || sender.lastGreeting != Long.MIN_VALUE && now - sender.lastGreeting < 3_000_000_000L) return null;
        sender.lastGreeting = now;
        return new Greeting("player_greeted", UUID.randomUUID().toString(), id, targetId, "하이! 👋", GREET_DURATION_MS);
    }
    /**
     * 연결이 종료된 방문자를 제거한다.
     * @param id 제거할 방문자 식별자
     * @return 실제로 상태를 제거했다면 true
     */
    public synchronized boolean leave(String id) { return members.remove(id) != null; }
}
