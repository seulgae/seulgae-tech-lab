package kr.seulgae.techlab.common.write;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 공개 쓰기의 글자 수·문자 검증, 수정 키, 속도 제한을 검증한다.
 * @author seulgae
 * @version 1.0, 익명 쓰기 공통 규칙
 * @see "None"
 */
class WriteRulesTest {
    @Test void countsCodePointsAndRejectsControlCharacters() {
        assertEquals("오늘의안건회의", TextRules.title("  오늘의안건회의 ", 8, "title"));
        assertEquals("👍👍👍👍👍👍👍👍", TextRules.title("👍👍👍👍👍👍👍👍", 8, "title"), "이모지 8개는 8자다");
        assertThrows(ResponseStatusException.class, () -> TextRules.title("아홉글자제목입니다", 8, "title"));
        assertThrows(ResponseStatusException.class, () -> TextRules.title("두 줄\n제목", 20, "title"));
        assertThrows(ResponseStatusException.class, () -> TextRules.title("   ", 8, "title"));
        assertEquals("첫 줄\n둘째 줄", TextRules.content("첫 줄\r\n둘째 줄", 130, "content"));
        assertEquals(130, TextRules.content("가".repeat(130), 130, "content").length());
        assertThrows(ResponseStatusException.class, () -> TextRules.content("가".repeat(131), 130, "content"));
        assertThrows(ResponseStatusException.class, () -> TextRules.content("벨\u0007", 130, "content"));
        assertThrows(ResponseStatusException.class, () -> TextRules.content(null, 130, "content"));
    }

    @Test void editTokensAreRandomHashedAndCheckedExactly() {
        var token = EditTokens.generate();
        assertTrue(token.matches("[A-Za-z0-9_-]{43}"));
        assertNotEquals(token, EditTokens.generate());
        var hash = EditTokens.hash(token);
        assertTrue(hash.matches("[0-9a-f]{64}"));
        assertTrue(EditTokens.matches(token, hash));
        assertFalse(EditTokens.matches(EditTokens.generate(), hash));
        assertFalse(EditTokens.matches(null, hash));
        assertFalse(EditTokens.matches(token, ""), "해시가 없는 V1 기록은 누구도 바꿀 수 없다");
        assertFalse(EditTokens.matches("short", EditTokens.hash("short")));
    }

    @Test void limitsBurstsPerClientAndRefillsOverTime() {
        var clock = new AtomicLong(1_000_000_000L);
        var limiter = new WriteRateLimiter(clock::get);
        for (int i = 0; i < 5; i++) limiter.check("1.1.1.1");
        var error = assertThrows(ResponseStatusException.class, () -> limiter.check("1.1.1.1"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
        limiter.check("2.2.2.2");
        clock.addAndGet(12_100_000_000L);
        limiter.check("1.1.1.1");
    }

    @Test void globalBudgetCapsManyClients() {
        var limiter = new WriteRateLimiter(new AtomicLong(1)::get);
        for (int i = 0; i < 30; i++) limiter.check("client-" + i);
        assertThrows(ResponseStatusException.class, () -> limiter.check("client-new"));
    }

    @Test void usesFirstForwardedAddress() {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        assertEquals("127.0.0.1", WriteRateLimiter.clientOf(request));
        request.addHeader("X-Forwarded-For", "203.0.113.7, 172.18.0.1");
        assertEquals("203.0.113.7", WriteRateLimiter.clientOf(request));
    }
}
