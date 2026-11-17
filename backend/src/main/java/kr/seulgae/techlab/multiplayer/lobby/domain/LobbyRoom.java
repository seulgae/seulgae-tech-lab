package kr.seulgae.techlab.multiplayer.lobby.domain;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 최대 5명의 임시 방문자와 서버 기준 이동 상태를 메모리에서 관리한다.
 *
 * @author seulgae
 * @version 1.0, 방별 접속 분리·서버 출입구 검증·방 세대 초기화
 * @see "None"
 */
@Component
public class LobbyRoom {
    public static final int MAX_PLAYERS = 5;
    /**
     * 스냅샷에 포함할 서버 기준 플레이어 상태이다.
     *
     * @author seulgae
     * @version 1.1, 위치·방향·이동·수신 입력 번호와 앉은 의자(seat, 없으면 null) 전달
     * @see "None"
     */
    public record PlayerView(String id, String nickname, double x, double y, String facing, boolean moving, long ack, String seat) {}
    /**
     * 클라이언트에서 완료한 한 물리 스텝의 방향과 시간이다. 좌표는 받지 않는다.
     * @author seulgae
     * @version 1.0, 입력 시간선 재생 명령
     * @see "None"
     */
    public record MoveCommand(int x, int y, double ms, long seq) {}
    /**
     * 서버 내부에서만 수정하는 방문자의 입력·위치 상태이다.
     * @author seulgae
     * @version 1.0, 단일 방문자 상태 관리
     * @see "None"
     */
    private static final class Member {
        String id, nickname, facing = "down";
        String roomId = "lobby";
        String seat;
        /** 앉기 요청 시점까지 받은 이동 번호. 이 번호 이하의 이동(앉기 전에 보낸 걸음)은 자리에서 일으키지 않는다. */
        long seatAfter = -1;
        /** 앉기 전에 보낸 걸음이 아직 처리 중이면, 그 걸음을 마친 뒤 앉을 의자 */
        String seatRequest;
        long roomEpoch, movedAt;
        double x, y;
        int inputX, inputY;
        long sequence = -1, inputAt;
        boolean moving;
        boolean commandMode;
        long budgetAt;
        double timeBudget = 250;
        long receivedSequence = -1;
        double pendingMs;
        final ArrayDeque<MoveCommand> pending = new ArrayDeque<>();
        PlayerView view() { return new PlayerView(id, nickname, x, y, facing, moving, sequence, seat); }
    }
    private final LinkedHashMap<String, Member> members = new LinkedHashMap<>();
    private final LobbyWorld world;
    private final LongSupplier clock;
    @Autowired
    public LobbyRoom(LobbyWorld world) { this(world, System::nanoTime); }

    /**
     * 접속 시각도 서버 단조 시계를 사용하며, 검증에서는 같은 시계를 고정할 수 있다.
     * @param world 충돌과 스폰을 계산할 공통 맵
     * @param clock 서버 단조 시각 공급자
     */
    public LobbyRoom(LobbyWorld world, LongSupplier clock) { this.world = world; this.clock = clock; }

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
            name = name.substring(0, name.offsetByCodePoints(0, Math.min(name.codePointCount(0, name.length()), 11))) + "-" + id.substring(0, 4);
        }
        var member = new Member();
        member.budgetAt = clock.getAsLong();
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
        if (member.commandMode) return false;
        member.inputX = x; member.inputY = y; member.sequence = sequence; member.inputAt = now;
        return true;
    }

    /**
     * 명령을 검증하고 시간 예산만큼 처리한다. 지연 후 몰린 나머지는 제한된 큐에서 기다린다.
     * @param id 방문자 식별자
     * @param commands 순서대로 완료할 최대 8개 물리 스텝
     * @param now 수신 시점의 서버 단조 시각
     * @return 새로운 입력을 수신했으면 true. ack는 실제 처리가 완료된 번호이다.
     * @throws IllegalArgumentException 방향·시간·번호·시간 예산이 유효하지 않은 경우
     */
    public synchronized boolean commands(String id, List<MoveCommand> commands, long now) {
        var member = members.get(id);
        if (member == null) return false;
        if (commands.isEmpty() || commands.size() > 8) throw new IllegalArgumentException("Movement batch");
        long received = Math.max(member.sequence, member.receivedSequence);
        long expected = received < 0 ? 1 : received + 1;
        double total = 0;
        for (var command : commands) {
            if (command.x() < -1 || command.x() > 1 || command.y() < -1 || command.y() > 1) throw new IllegalArgumentException("Movement axes");
            if (!Double.isFinite(command.ms()) || command.ms() < 0 || command.ms() > 50
                || command.ms() == 0 && (command.x() != 0 || command.y() != 0)) throw new IllegalArgumentException("Movement duration");
            if (command.seq() < 1 || command.seq() > 9_007_199_254_740_991L) throw new IllegalArgumentException("Movement sequence");
            if (command.seq() <= received) continue;
            if (command.seq() != expected++) throw new IllegalArgumentException("Movement sequence");
            total += command.ms();
        }
        int fresh = (int) (expected - (received < 0 ? 1 : received + 1));
        if (fresh == 0) return false;
        drainCommands(member, now);
        if (member.pendingMs + total > 2000.001 || member.pending.size() + fresh > 240) {
            throw new IllegalArgumentException("Movement backlog exceeded");
        }
        member.commandMode = true;
        for (var command : commands) {
            if (command.seq() <= received) continue;
            member.pending.addLast(command); member.receivedSequence = command.seq();
        }
        member.pendingMs += total;
        drainCommands(member, now);
        return true;
    }

    /** 서버 단조 시계로 예산을 보충해, 대기한 명령도 가속 없이 순서대로 완료한다. */
    private void drainCommands(Member member, long now) {
        // 잠금을 기다린 수신 콜백의 시각이 이전 갱신보다 오래돼도 예산 시계를 되돌리지 않는다.
        now = Math.max(now, member.budgetAt);
        member.timeBudget = Math.min(2000, member.timeBudget + Math.max(0, now - member.budgetAt) / 1_000_000d);
        member.budgetAt = now;
        while (!member.pending.isEmpty() && member.pending.peekFirst().ms() <= member.timeBudget + 0.001) {
            var command = member.pending.removeFirst();
            // 앉은 뒤에 보낸 이동 명령이 처리되면 자리에서 일어난다(앉기 전에 보낸 걸음은 제외).
            if ((command.x() != 0 || command.y() != 0) && command.seq() > member.seatAfter) { member.seat = null; member.seatRequest = null; }
            member.timeBudget = Math.max(0, member.timeBudget - command.ms());
            member.pendingMs = Math.max(0, member.pendingMs - command.ms());
            double length = Math.hypot(command.x(), command.y());
            var position = world.moveIn(member.roomId, member.x, member.y,
                length == 0 ? 0 : command.x() / length * 200 * command.ms() / 1000,
                length == 0 ? 0 : command.y() / length * 200 * command.ms() / 1000);
            member.moving = Math.hypot(position.x() - member.x, position.y() - member.y) > 0.001;
            member.x = position.x(); member.y = position.y(); member.sequence = command.seq(); member.inputAt = now;
            if (command.y() != 0) member.facing = command.y() < 0 ? "up" : "down";
            else if (command.x() != 0) member.facing = command.x() < 0 ? "left" : "right";
        }
        applySeatRequest(member);
    }

    /** 앉기 전에 보낸 걸음을 모두 처리했으면 그 위치에서 앉기를 확정한다(멀거나 자리가 찼으면 취소). */
    private void applySeatRequest(Member m) {
        if (m.seatRequest == null || m.pending.stream().anyMatch(command -> command.seq() <= m.seatAfter)) return;
        String seatId = m.seatRequest;
        m.seatRequest = null;
        if (!world.nearSeat(m.roomId, seatId, m.x, m.y)) return;
        for (var other : members.values()) if (other != m && other.roomId.equals(m.roomId) && seatId.equals(other.seat)) return;
        m.seat = seatId; m.moving = false;
    }

    /**
     * 구형 입력은 서버 시계로 적분하고, 완료 스텝 방식은 좌표를 추가 적분하지 않는다.
     * 입력이 300ms 이상 끊기면 원격 걷기 표시를 정지 상태로 전환한다.
     *
     * @param seconds 이전 서버 갱신 이후의 초 단위 경과 시간
     * @param now 현재 서버 단조 시각, 나노초
     */
    public synchronized void step(double seconds, long now) {
        double elapsed = Math.max(0, Math.min(0.1, seconds));
        for (var member : members.values()) {
            if (member.commandMode) {
                drainCommands(member, now);
                // 이미 검증한 대기 명령만 처리하고, 받지 않은 이동은 추측하지 않는다.
                if (member.pending.isEmpty() && now - member.inputAt > 300_000_000L) member.moving = false;
                continue;
            }
            int x = now - member.inputAt <= 300_000_000L ? member.inputX : 0;
            int y = now - member.inputAt <= 300_000_000L ? member.inputY : 0;
            if (x != 0 || y != 0) member.seat = null;
            if (y != 0) member.facing = y < 0 ? "up" : "down";
            else if (x != 0) member.facing = x < 0 ? "left" : "right";
            double length = Math.hypot(x, y);
            var position = world.moveIn(member.roomId, member.x, member.y, length == 0 ? 0 : x / length * 200 * elapsed, length == 0 ? 0 : y / length * 200 * elapsed);
            member.moving = Math.hypot(position.x() - member.x, position.y() - member.y) > 0.001;
            member.x = position.x(); member.y = position.y();
        }
    }

    /** @return 내부 가변 객체를 노출하지 않는 현재 접속자 상태 목록 */
    public synchronized List<PlayerView> snapshot() { return members.values().stream().map(Member::view).toList(); }

    /** 연결 내 방 세대를 대조해 이전 방의 지연 입력을 배제한다. */
    public synchronized long epoch(String id) { return members.get(id).roomEpoch; }
    public synchronized String roomId(String id) { return members.get(id).roomId; }
    public synchronized List<PlayerView> snapshot(String roomId) {
        return members.values().stream().filter(m -> m.roomId.equals(roomId)).map(Member::view).toList();
    }

    /** 출입구 검증 후 대기 명령·ACK·속도를 함께 초기화하며 소켓 ID는 유지한다. */
    public synchronized PlayerView changeRoom(String id, String doorId, long now) {
        var m = members.get(id);
        if (m == null || m.movedAt != 0 && now - m.movedAt < 1_000_000_000L) throw new IllegalArgumentException("Room transition cooldown");
        String target = world.destination(m.roomId, doorId, m.x, m.y);
        var spawn = world.roomSpawn(target);
        m.roomId = target; m.roomEpoch++; m.movedAt = now; m.seat = null; m.seatRequest = null;
        m.x = spawn.x(); m.y = spawn.y(); m.facing = "down"; m.moving = false;
        m.inputX = 0; m.inputY = 0; m.sequence = -1; m.receivedSequence = -1;
        m.pending.clear(); m.pendingMs = 0; m.timeBudget = 250; m.budgetAt = now;
        return m.view();
    }

    /**
     * 의자에 앉거나(seatId) 일어난다(null). 서버 좌표가 의자 근처이고 다른 사람이 앉아 있지 않을 때만 앉는다.
     * 위치는 바꾸지 않으며, 앉은 뒤에 보낸 이동 명령이 처리되면 자동으로 일어난다.
     * @return 상태를 바꿨으면 true
     */
    public synchronized boolean sit(String id, String seatId) {
        var m = members.get(id);
        if (m == null) return false;
        if (seatId == null) { boolean changed = m.seat != null || m.seatRequest != null; m.seat = null; m.seatRequest = null; return changed; }
        m.seatAfter = m.receivedSequence;
        // 운영 지연(약 1초)으로 앉기 직전 걸음이 아직 서버에 남아 있으면, 그 걸음을 마친 위치에서 앉는다.
        if (m.commandMode && m.pending.stream().anyMatch(command -> command.seq() <= m.seatAfter)) { m.seatRequest = seatId; return true; }
        if (!world.nearSeat(m.roomId, seatId, m.x, m.y)) return false;
        for (var other : members.values()) if (other != m && other.roomId.equals(m.roomId) && seatId.equals(other.seat)) return false;
        m.seat = seatId; m.moving = false;
        return true;
    }

    /** 서버 좌표 기준으로 플레이어가 현재 방의 지정 상호작용 범위 안에 있는지 확인한다. */
    public synchronized boolean near(String id, String kind) {
        var m = members.get(id);
        return m != null && world.near(m.roomId, kind, m.x, m.y);
    }

    /** @return 같은 방에서 지정 상호작용 범위 안에 있는 플레이어 ID */
    public synchronized Set<String> playersNear(String roomId, String kind) {
        var ids = new LinkedHashSet<String>();
        for (var m : members.values()) if (m.roomId.equals(roomId) && world.near(roomId, kind, m.x, m.y)) ids.add(m.id);
        return ids;
    }

    /** 관제실 CCTV 상호작용(kind=cctv)이 있는 방이면 모든 방의 참가자를 볼 수 있다. */
    public boolean monitorsAllRooms(String roomId) {
        return world.interactions(roomId).stream().anyMatch(interaction -> "cctv".equals(interaction.kind()));
    }

    /** @return 맵 정의 순서의 방별 접속자 상태(빈 방 포함). 관제실 CCTV 화면에 쓴다. */
    public synchronized Map<String, List<PlayerView>> snapshotsByRoom() {
        var rooms = new LinkedHashMap<String, List<PlayerView>>();
        for (var roomId : world.roomIds()) rooms.put(roomId, new ArrayList<>());
        for (var m : members.values()) rooms.computeIfAbsent(m.roomId, ignored -> new ArrayList<>()).add(m.view());
        return rooms;
    }

    /** @return 공유 맵의 모든 방을 포함한 방별 접속자 수, 맵 정의 순서 */
    public synchronized Map<String, Integer> roomCounts() {
        var counts = new LinkedHashMap<String, Integer>();
        for (var roomId : world.roomIds()) counts.put(roomId, 0);
        for (var m : members.values()) counts.merge(m.roomId, 1, Integer::sum);
        return counts;
    }

    /** @return 현재 접속 중인 플레이어의 읽기 전용 상태 또는 null */
    public synchronized PlayerView player(String id) { var member = members.get(id); return member == null ? null : member.view(); }
    /**
     * 연결이 종료된 방문자를 제거한다.
     * @param id 제거할 방문자 식별자
     * @return 실제로 상태를 제거했다면 true
     */
    public synchronized boolean leave(String id) { return members.remove(id) != null; }
}
