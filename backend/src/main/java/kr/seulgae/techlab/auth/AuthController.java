package kr.seulgae.techlab.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.admin.AdminAccess;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 카카오 로그인·로그아웃·내 정보 API이다.
 * 로그인 상태는 서명된 HttpOnly 쿠키(SameSite=Lax)로 유지하고, 인가 요청의 state를 짧은 쿠키로 대조해 CSRF를 막는다.
 *
 * @author seulgae
 * @version 1.0, 카카오 로그인
 * @see "None"
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger LOG = LoggerFactory.getLogger(AuthController.class);
    private static final String STATE_COOKIE = "lab_oauth_state";
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * 화면에 보여 줄 회원 정보
     * @param id 회원 ID
     * @param nickname 닉네임
     * @author seulgae
     * @version 1.0, 내 정보
     * @see "None"
     */
    public record MemberView(UUID id, String nickname) {}
    /**
     * 로그인 사용 가능 여부와 현재 회원(없으면 null)
     * @param kakaoEnabled 카카오 로그인 설정 여부
     * @param member 현재 회원
     * @param admin 관리자 회원이면 true. 관리자실 문과 쿼리 콘솔에 쓴다(실제 권한은 관리자 API가 매번 확인).
     * @param level 회원 등급(1 일반 사용자, 2 운영자, 3 관리자). 로그인하지 않았으면 0
     * @author seulgae
     * @version 1.2, 내 정보 응답(관리자 여부·등급)
     * @see "None"
     */
    public record Me(boolean kakaoEnabled, MemberView member, boolean admin, int level) {}
    /**
     * 닉네임 변경 요청
     * @param nickname 새 닉네임
     * @author seulgae
     * @version 1.0, 닉네임 변경
     * @see "None"
     */
    public record NicknameRequest(String nickname) {}

    private final AuthService auth;
    private final MemberRepository members;
    private final WriteRateLimiter limiter;
    private final AdminAccess admins;
    private final LevelService levels;
    public AuthController(AuthService auth, MemberRepository members, WriteRateLimiter limiter, AdminAccess admins, LevelService levels) {
        this.auth = auth; this.members = members; this.limiter = limiter; this.admins = admins; this.levels = levels;
    }

    @GetMapping("/me")
    public Me me(HttpServletRequest request) {
        var member = auth.current(request);
        return new Me(auth.enabled(), member.map(m -> new MemberView(m.id(), m.nickname())).orElse(null), member.map(m -> admins.isAdmin(m.id())).orElse(false),
            member.map(m -> levels.level(m.id())).orElse(0));
    }

    /** 로그인한 회원이 쓴 최근 글 ID. 화면이 "내 글" 표시와 수정·삭제 버튼에 쓴다. */
    @GetMapping("/me/owned")
    public Map<String, List<UUID>> owned(HttpServletRequest request) {
        return auth.current(request).map(member -> Map.of("recordIds", members.recentRecordIds(member.id()), "agendaIds", members.recentAgendaIds(member.id())))
            .orElse(Map.of("recordIds", List.of(), "agendaIds", List.of()));
    }

    @PutMapping("/me/nickname")
    public MemberView rename(@RequestBody(required = false) NicknameRequest body, HttpServletRequest request) {
        var member = auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required"));
        limiter.check(request);
        var renamed = auth.rename(member, body == null ? null : body.nickname());
        return new MemberView(renamed.id(), renamed.nickname());
    }

    /** 카카오 인가 화면으로 보낸다. */
    @GetMapping("/kakao/login")
    public ResponseEntity<Void> login() {
        if (!auth.enabled()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Kakao login is not configured");
        var bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(auth.kakao().authorizeUrl(auth.settings(), state)))
            .header(HttpHeaders.SET_COOKIE, cookie(STATE_COOKIE, state, 600, "/api/auth/kakao").toString()).build();
    }

    /** 카카오가 돌려보낸 인가 코드로 로그인(처음이면 가입)하고 연구소로 돌아간다. */
    @GetMapping("/kakao/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code, @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error, HttpServletRequest request) {
        var clearState = cookie(STATE_COOKIE, "", 0, "/api/auth/kakao").toString();
        String expected = request.getCookies() == null ? null : Arrays.stream(request.getCookies())
            .filter(cookie -> STATE_COOKIE.equals(cookie.getName())).map(jakarta.servlet.http.Cookie::getValue).findFirst().orElse(null);
        if (!auth.enabled() || error != null || code == null || state == null || expected == null || !expected.equals(state)) {
            return redirect("/?login=failed", clearState, null);
        }
        try {
            var login = auth.login(code);
            var session = cookie(SessionCookies.NAME, auth.issueSession(login.member()), SessionCookies.TTL.toSeconds(), "/").toString();
            return redirect(login.created() ? "/?welcome=1" : "/", clearState, session);
        } catch (RuntimeException exception) {
            LOG.warn("Kakao login failed: {}", exception.getClass().getSimpleName());
            return redirect("/?login=failed", clearState, null);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie(SessionCookies.NAME, "", 0, "/").toString()).build();
    }

    private ResponseEntity<Void> redirect(String location, String clearState, String session) {
        var response = ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).header(HttpHeaders.SET_COOKIE, clearState);
        if (session != null) response.header(HttpHeaders.SET_COOKIE, session);
        return response.build();
    }

    private ResponseCookie cookie(String name, String value, long maxAgeSeconds, String path) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(auth.settings().cookieSecure()).sameSite("Lax").path(path).maxAge(maxAgeSeconds).build();
    }
}
