package kr.seulgae.techlab.common.write;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로그인 없는 공개 쓰기(작성·수정·삭제)의 도배를 막는 토큰 버킷 제한이다.
 * 접속 주소별로 여유 5회·12초마다 1회 보충, 서버 전체로 여유 30회·30초마다 1회 보충한다.
 *
 * @author seulgae
 * @version 1.0, 안건·아이디어 일지 쓰기 제한
 * @see "None"
 */
@Component
public class WriteRateLimiter {
    static final double CLIENT_CAPACITY = 5, CLIENT_REFILL_PER_SECOND = 1 / 12d;
    static final double GLOBAL_CAPACITY = 30, GLOBAL_REFILL_PER_SECOND = 1 / 30d;
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    /**
     * 한 접속 주소 또는 서버 전체의 남은 쓰기 예산이다.
     * @author seulgae
     * @version 1.0, 토큰 버킷 상태
     * @see "None"
     */
    private static final class Bucket {
        double tokens; long updated;
        Bucket(double tokens, long now) { this.tokens = tokens; this.updated = now; }
        boolean take(double capacity, double perSecond, long now) {
            tokens = Math.min(capacity, tokens + Math.max(0, now - updated) / 1e9 * perSecond);
            updated = now;
            if (tokens < 1) return false;
            tokens--;
            return true;
        }
    }

    private final LongSupplier clock;
    private final double clientCapacity;
    private final double globalCapacity;
    private final Bucket global;
    private final Map<String, Bucket> clients = new LinkedHashMap<>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) { return size() > MAX_TRACKED_CLIENTS; }
    };

    /** 운영 기본값을 쓰며, 일회용 CI DB 통합 검증처럼 연속 쓰기가 필요한 곳에서만 여유분을 늘린다. */
    @Autowired
    public WriteRateLimiter(@Value("${lab.write.client-capacity:5}") double clientCapacity,
                            @Value("${lab.write.global-capacity:30}") double globalCapacity) {
        this(System::nanoTime, clientCapacity, globalCapacity);
    }

    public WriteRateLimiter(LongSupplier clock) { this(clock, CLIENT_CAPACITY, GLOBAL_CAPACITY); }

    WriteRateLimiter(LongSupplier clock, double clientCapacity, double globalCapacity) {
        this.clock = clock;
        this.clientCapacity = clientCapacity;
        this.globalCapacity = globalCapacity;
        this.global = new Bucket(globalCapacity, clock.getAsLong());
    }

    /**
     * 요청 주소의 예산을 확인한다. 개별·전체 예산을 모두 소비할 수 있을 때만 통과한다.
     * @throws ResponseStatusException 429 예산 초과
     */
    public synchronized void check(String client) {
        long now = clock.getAsLong();
        var bucket = clients.computeIfAbsent(client, ignored -> new Bucket(clientCapacity, now));
        // 개별 예산을 먼저 확인해, 한 주소의 도배가 서버 전체 예산을 소진하지 못하게 한다.
        if (!bucket.take(clientCapacity, CLIENT_REFILL_PER_SECOND, now)) throw tooMany();
        if (!global.take(globalCapacity, GLOBAL_REFILL_PER_SECOND, now)) { bucket.tokens++; throw tooMany(); }
    }

    public void check(HttpServletRequest request) { check(clientOf(request)); }

    /** Funnel·nginx가 붙인 X-Forwarded-For의 첫 주소, 없으면 직접 연결 주소 */
    static String clientOf(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].strip();
            if (!first.isEmpty() && first.length() <= 64) return first;
        }
        return String.valueOf(request.getRemoteAddr());
    }

    private static ResponseStatusException tooMany() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many writes. Please wait a moment.");
    }
}
