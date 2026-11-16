package kr.seulgae.techlab.multiplayer.lobby.domain;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * 각 방의 최근 일반 텍스트 50개와 이동 입력과 독립적인 채팅 전송 제한을 관리한다.
 * @author seulgae
 * @version 1.0, 방별 50개 메모리 기록과 연결별 전송 제한 유지
 * @see "None"
 */
@Component
public class LobbyChat {
    /**
     * 서버가 생성한 식별자·발신자·시각을 갖는 일반 텍스트 채팅이다.
     * @author seulgae
     * @version 1.0, 실시간 방송 및 최근 기록 데이터
     * @see "None"
     */
    public record Message(String type, String messageId, String playerId, String nickname, String message, String sentAt) {}
    /**
     * 개별 세션에만 알려주는 채팅 거부 사유이다. 연결을 종료하지 않는다.
     * @author seulgae
     * @version 1.0, 채팅 검증 오류
     * @see "None"
     */
    public static class Rejected extends RuntimeException {
        public Rejected(String reason) { super(reason); }
    }
    /**
     * 세션별로 3개 여유분과 초당 1개 보충을 갖는 채팅 예산이다.
     * @author seulgae
     * @version 1.0, 이동 제한과 독립된 채팅 도배 방지
     * @see "None"
     */
    private static final class Budget {
        double tokens = 3;
        long updated;
        Budget(long now) { updated = now; }
    }
    private final LobbyRoom room;
    private final Map<String, ArrayDeque<Message>> histories = new HashMap<>();
    private final Map<String, Budget> budgets = new HashMap<>();
    public LobbyChat(LobbyRoom room) { this.room = room; }

    /**
     * 존재하는 세션의 메시지만 수용하며 발신자와 시각은 서버에서 정한다.
     * @param playerId 연결에 매핑된 플레이어
     * @param text 클라이언트 일반 텍스트
     * @param now 서버 단조 시각
     * @return 검증된 방송 메시지
     * @throws Rejected 비어 있음·길이·제어 문자·전송 제한·세션 검증에 실패한 경우
     */
    public synchronized Message post(String playerId, String text, long now) {
        var player = room.player(playerId);
        if (player == null) throw new Rejected("unavailable");
        var budget = budgets.computeIfAbsent(playerId, ignored -> new Budget(now));
        budget.tokens = Math.min(3, budget.tokens + Math.max(0, now - budget.updated) / 1_000_000_000d);
        budget.updated = now;
        if (budget.tokens < 1) throw new Rejected("rate_limited");
        budget.tokens--;
        if (text == null) throw new Rejected("invalid");
        String message = text.replace("\r\n", "\n").replace('\r', '\n').replaceAll("(?U)^[\\s\uFEFF]+|[\\s\uFEFF]+$", "");
        if (message.isEmpty()) throw new Rejected("empty");
        if (message.codePointCount(0, message.length()) > 150) throw new Rejected("too_long");
        if (message.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\t' || c >= 0xd800 && c <= 0xdfff)) throw new Rejected("invalid");
        var result = new Message("chat_message", UUID.randomUUID().toString(), player.id(), player.nickname(), message, Instant.now().toString());
        var messages = histories.computeIfAbsent(room.roomId(playerId), ignored -> new ArrayDeque<>());
        messages.addLast(result);
        while (messages.size() > 50) messages.removeFirst();
        return result;
    }

    /** @return 변경할 수 없는 최근 50개 이하의 시간순 기록 */
    public synchronized List<Message> history() { return history("lobby"); }
    /** 현재 방의 최근 기록만 조회한다. */
    public synchronized List<Message> history(String roomId) { return List.copyOf(histories.getOrDefault(roomId, new ArrayDeque<>())); }

    /** 퇴장한 세션의 제한 상태는 최근 대화와 별개로 제거한다. */
    public synchronized void leave(String playerId) { budgets.remove(playerId); }
}
