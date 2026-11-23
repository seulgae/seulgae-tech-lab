package kr.seulgae.techlab.auth.service.impl;

import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.entity.*;
import kr.seulgae.techlab.auth.service.*;
import kr.seulgae.techlab.auth.repository.*;
import kr.seulgae.techlab.auth.config.*;
import kr.seulgae.techlab.auth.support.*;
import kr.seulgae.techlab.auth.client.*;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 카카오 로그인(처음이면 회원가입), 현재 회원 확인, 글쓰기 권한을 처리한다.
 * 로그인이 꺼져 있으면(키 미설정) 글쓰기는 기존처럼 누구나 할 수 있다.
 *
 * @author seulgae
 * @version 1.0, 카카오 로그인과 글쓰기 권한
 * @see "None"
 */
@Service
public class AuthServiceImpl implements AuthService {

    private final AuthSettings settings;
    private final MemberRepository members;
    private final KakaoClient kakao;
    private final Clock clock;

    @Autowired
    public AuthServiceImpl(AuthSettings settings, MemberRepository members, KakaoClient kakao) { this(settings, members, kakao, Clock.systemUTC()); }

    public AuthServiceImpl(AuthSettings settings, MemberRepository members, KakaoClient kakao, Clock clock) {
        this.settings = settings; this.members = members; this.kakao = kakao; this.clock = clock;
    }

    public boolean enabled() { return settings.enabled(); }
    public AuthSettings settings() { return settings; }
    public KakaoClient kakao() { return kakao; }
    SessionCookies cookies() { return new SessionCookies(settings.sessionSecret()); }

    /** 서명 쿠키가 유효하고 회원이 있으면 현재 회원 */
    public Optional<Member> current(HttpServletRequest request) {
        if (!enabled() || request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies()).filter(cookie -> SessionCookies.NAME.equals(cookie.getName())).findFirst()
            .flatMap(cookie -> cookies().verify(cookie.getValue(), clock.instant()))
            .flatMap(members::findById);
    }

    /**
     * 글쓰기 작성자를 정한다. 로그인이 켜져 있으면 회원만 쓸 수 있고(401), 꺼져 있으면 익명(빈 값)으로 허용한다.
     */
    public Optional<UUID> writer(HttpServletRequest request) {
        if (!enabled()) return Optional.empty();
        return Optional.of(current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "LoginDTO required")).id());
    }

    /** 인가 코드로 카카오 회원을 확인하고, 처음이면 카카오 닉네임으로 회원을 만든다. */
    public LoginDTO login(String code) {
        var user = kakao.fetchUser(settings, code);
        var existing = members.loginByKakaoId(user.id());
        if (existing.isPresent()) return new LoginDTO(existing.get(), false);
        var id = UUID.randomUUID();
        return new LoginDTO(members.create(id, user.id(), Member.suggestNickname(user.nickname(), id)), true);
    }

    public String issueSession(Member member) { return cookies().issue(member.id(), clock.instant()); }

    public Member rename(Member member, String nickname) {
        String value = nickname == null ? "" : nickname.strip();
        if (!value.matches(Member.NICKNAME_PATTERN)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nickname must be 1-16 letters, digits, _ or -");
        members.updateNickname(member.id(), value);
        return new Member(member.id(), member.kakaoId(), value);
    }
}
