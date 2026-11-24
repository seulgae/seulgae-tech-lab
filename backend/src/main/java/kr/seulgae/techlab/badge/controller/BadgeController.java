package kr.seulgae.techlab.badge.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.badge.dto.BadgeViewDTO;
import kr.seulgae.techlab.badge.service.BadgeService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 사원증·급여 API(로그인 회원 전용). tick은 화면이 1분마다 보내며, 지급 여부는 서버가 10분 간격으로 판정한다.
 * 글쓰기 제한은 걸지 않는다(1분에 한 번 오는 정상 요청이고, 지급은 10분에 한 번만 된다).
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see "None"
 */
@RestController
@RequestMapping("/api/badge")
public class BadgeController {
    private final BadgeService service;
    private final AuthService auth;

    public BadgeController(BadgeService service, AuthService auth) { this.service = service; this.auth = auth; }

    /**
     * 사원증.
     *
     * @param request HTTP 요청
     * @return 사원증 화면 값
     */
    @GetMapping
    public BadgeViewDTO view(HttpServletRequest request) { return service.view(member(request)); }

    /**
     * 접속 중 급여 확인(차례면 지급).
     *
     * @param request HTTP 요청
     * @return 사원증 화면 값(paid에 방금 받은 급여)
     */
    @PostMapping("/tick")
    public BadgeViewDTO tick(HttpServletRequest request) { return service.tick(member(request)); }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }
}
