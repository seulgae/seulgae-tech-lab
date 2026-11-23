package kr.seulgae.techlab.auth.service.impl;

import kr.seulgae.techlab.auth.client.*;
import kr.seulgae.techlab.auth.config.*;
import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.entity.*;
import kr.seulgae.techlab.auth.repository.impl.*;
import kr.seulgae.techlab.auth.support.*;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 서명 세션 쿠키, 카카오 로그인(가입·재로그인), 글쓰기 권한, 닉네임 규칙을 검증한다.
 * @author seulgae
 * @version 1.0, 카카오 로그인
 * @see "None"
 */
class AuthTest {
    private static final String SECRET = "s".repeat(40);
    private static final Instant NOW = Instant.parse("2026-11-17T00:00:00Z");
    private final AuthSettings enabled = new AuthSettings("rest-key", "", "https://lab.example/api/auth/kakao/callback", SECRET, true);
    private final AuthSettings disabled = new AuthSettings("", "", "", "", true);

    @Test void sessionCookieIsSignedAndExpires() {
        var cookies = new SessionCookies(SECRET);
        var id = UUID.randomUUID();
        String value = cookies.issue(id, NOW);
        assertEquals(Optional.of(id), cookies.verify(value, NOW.plusSeconds(60)));
        assertTrue(cookies.verify(value, NOW.plus(SessionCookies.TTL).plusSeconds(1)).isEmpty(), "만료된 세션");
        assertTrue(cookies.verify(value.substring(0, value.length() - 2) + "xx", NOW).isEmpty(), "서명 위조");
        assertTrue(new SessionCookies("o".repeat(40)).verify(value, NOW).isEmpty(), "다른 비밀값");
        assertTrue(cookies.verify(UUID.randomUUID() + value.substring(36), NOW).isEmpty(), "회원 ID 바꿔치기");
        assertTrue(cookies.verify("garbage", NOW).isEmpty());
    }

    @Test void loginIsEnabledOnlyWithAllSettings() {
        assertTrue(enabled.enabled());
        assertFalse(disabled.enabled());
        assertFalse(new AuthSettings("key", "", "https://x", "short", true).enabled(), "짧은 비밀값은 거부");
        assertFalse(new AuthSettings("key", "", "", SECRET, true).enabled());
    }

    @Test void firstKakaoLoginCreatesMemberAndLaterLoginsReuseIt() {
        var members = mock(JdbcMemberRepository.class);
        var kakao = mock(KakaoClient.class);
        var service = new AuthServiceImpl(enabled, members, kakao, Clock.fixed(NOW, ZoneOffset.UTC));
        when(kakao.fetchUser(enabled, "code")).thenReturn(new KakaoUserDTO(42L, "슬개 🐶 연구원!"));
        when(members.loginByKakaoId(42L)).thenReturn(Optional.empty());
        when(members.create(any(), eq(42L), anyString())).thenAnswer(call -> new Member(call.getArgument(0), 42L, call.getArgument(2)));
        var first = service.login("code");
        assertTrue(first.created());
        assertEquals("슬개연구원", first.member().nickname(), "허용하지 않는 문자를 뺀 카카오 닉네임");

        when(members.loginByKakaoId(42L)).thenReturn(Optional.of(first.member()));
        assertFalse(service.login("code").created());
        verify(members, times(1)).create(any(), anyLong(), anyString());
    }

    @Test void writesNeedLoginOnlyWhenKakaoIsConfigured() {
        var members = mock(JdbcMemberRepository.class);
        var anonymous = new MockHttpServletRequest();
        assertEquals(Optional.empty(), new AuthServiceImpl(disabled, members, mock(KakaoClient.class)).writer(anonymous), "키가 없으면 지금처럼 누구나 쓴다");

        var service = new AuthServiceImpl(enabled, members, mock(KakaoClient.class), Clock.fixed(NOW, ZoneOffset.UTC));
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class, () -> service.writer(anonymous)).getStatusCode());
        var member = new Member(UUID.randomUUID(), 7L, "연구원");
        when(members.findById(member.id())).thenReturn(Optional.of(member));
        var loggedIn = new MockHttpServletRequest();
        loggedIn.setCookies(new Cookie(SessionCookies.NAME, service.issueSession(member)));
        assertEquals(Optional.of(member.id()), service.writer(loggedIn));
    }

    @Test void nicknamesFollowLobbyRules() {
        var id = UUID.fromString("abcd0000-0000-4000-8000-000000000000");
        assertEquals("연구원-abcd", Member.suggestNickname("!!!", id));
        assertEquals("연구원-abcd", Member.suggestNickname(null, id));
        assertEquals("가".repeat(16), Member.suggestNickname("가".repeat(20), id));
        var members = mock(JdbcMemberRepository.class);
        var service = new AuthServiceImpl(enabled, members, mock(KakaoClient.class));
        var member = new Member(id, 1L, "old");
        assertEquals("새이름_1", service.rename(member, " 새이름_1 ").nickname());
        assertThrows(ResponseStatusException.class, () -> service.rename(member, "공백 포함"));
        assertThrows(ResponseStatusException.class, () -> service.rename(member, "a".repeat(17)));
    }
}
