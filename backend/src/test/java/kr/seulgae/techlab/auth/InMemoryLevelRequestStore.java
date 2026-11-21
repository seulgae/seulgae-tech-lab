package kr.seulgae.techlab.auth;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 테스트·DB 없는 로컬 실행용 등급 신청 저장소
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 */
public class InMemoryLevelRequestStore implements LevelRequestStore {
    private final List<LevelRequest> requests = new ArrayList<>();
    private final Map<UUID, Integer> levels = new ConcurrentHashMap<>();
    private OffsetDateTime clock = OffsetDateTime.parse("2026-11-21T12:00:00+09:00");

    /** 테스트에서 회원 등급을 바로 정한다. */
    public void setLevel(UUID member, int level) { levels.put(member, level); }

    @Override public synchronized Optional<LevelRequest> create(UUID memberId, int level, String reason) {
        if (requests.stream().anyMatch(r -> r.memberId().equals(memberId) && r.status().equals("PENDING"))) return Optional.empty();
        clock = clock.plusSeconds(1);
        var request = new LevelRequest(UUID.randomUUID(), memberId, "회원", level, reason, "PENDING", clock);
        requests.add(request);
        return Optional.of(request);
    }

    @Override public synchronized Optional<LevelRequest> latest(UUID memberId) {
        return requests.stream().filter(r -> r.memberId().equals(memberId)).max(Comparator.comparing(LevelRequest::createdAt));
    }

    @Override public synchronized List<LevelRequest> pending() {
        return requests.stream().filter(r -> r.status().equals("PENDING")).toList();
    }

    @Override public synchronized Optional<LevelRequest> decide(UUID requestId, boolean approve, UUID decidedBy) {
        for (int i = 0; i < requests.size(); i++) {
            var r = requests.get(i);
            if (!r.id().equals(requestId) || !r.status().equals("PENDING")) continue;
            var decided = new LevelRequest(r.id(), r.memberId(), r.nickname(), r.requestedLevel(), r.reason(), approve ? "APPROVED" : "REJECTED", r.createdAt());
            requests.set(i, decided);
            if (approve) levels.put(r.memberId(), r.requestedLevel());
            return Optional.of(decided);
        }
        return Optional.empty();
    }

    @Override public int level(UUID memberId) { return levels.getOrDefault(memberId, 1); }
}
