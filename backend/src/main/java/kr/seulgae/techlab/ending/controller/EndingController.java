package kr.seulgae.techlab.ending.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.ending.service.EndingService;
import kr.seulgae.techlab.ending.service.EndingService.EndingStatus;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 야외 표지판에서 사용하는 로그인 회원 전용 엔딩 API다.
 *
 * @author seulgae
 * @version 1.0, 엔딩 상태 조회와 완료 요청
 * @see EndingService
 */
@RestController
@RequestMapping("/api/ending")
public class EndingController {
    private final AuthService auth;
    private final EndingService ending;

    public EndingController(AuthService auth, EndingService ending) {
        this.auth = auth;
        this.ending = ending;
    }

    /**
     * 현재 회원의 엔딩 상태를 제공한다.
     *
     * @param request 로그인 쿠키를 담은 요청
     * @return 엔딩 자격과 환생 여부
     */
    @GetMapping
    public EndingStatus status(HttpServletRequest request) {
        return ending.status(member(request));
    }

    /**
     * 마지막 대화에 동의한 회원의 환생 기록을 저장한다.
     *
     * @param request 로그인 쿠키를 담은 요청
     */
    @PostMapping(value = "/complete", consumes = "application/json")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void complete(HttpServletRequest request) {
        ending.complete(member(request));
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).id();
    }
}
