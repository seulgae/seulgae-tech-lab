package kr.seulgae.techlab.auth.service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.entity.*;
import kr.seulgae.techlab.auth.config.*;
import kr.seulgae.techlab.auth.client.*;

/**
 * AuthService 기능 명세(구현: AuthServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface AuthService {
    boolean enabled();

    AuthSettings settings();

    KakaoClient kakao();

    /** 서명 쿠키가 유효하고 회원이 있으면 현재 회원 */
    Optional<Member> current(HttpServletRequest request);

    /**
     * 글쓰기 작성자를 정한다. 로그인이 켜져 있으면 회원만 쓸 수 있고(401), 꺼져 있으면 익명(빈 값)으로 허용한다.
     */
    Optional<UUID> writer(HttpServletRequest request);

    /** 인가 코드로 카카오 회원을 확인하고, 처음이면 카카오 닉네임으로 회원을 만든다. */
    LoginDTO login(String code);

    String issueSession(Member member);

    Member rename(Member member, String nickname);
}
