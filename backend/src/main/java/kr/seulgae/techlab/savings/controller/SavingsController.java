package kr.seulgae.techlab.savings.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.savings.dto.SavingsRequestDTO;
import kr.seulgae.techlab.savings.dto.SavingsViewDTO;
import kr.seulgae.techlab.savings.service.SavingsService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 은행 적금 API. 로그인한 회원만, 자기 적금만 다룬다.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
@RestController
@RequestMapping("/api/savings")
public class SavingsController {
    private final SavingsService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public SavingsController(SavingsService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    /**
     * 동전·상품·내 적금.
     *
     * @param request HTTP 요청
     * @return 적금 화면 값
     */
    @GetMapping
    public SavingsViewDTO view(HttpServletRequest request) { return service.view(member(request)); }

    /**
     * 적금 가입.
     *
     * @param body 원금과 기간
     * @param request HTTP 요청
     * @return 적금 화면 값
     */
    @PostMapping("/deposit")
    public SavingsViewDTO deposit(@RequestBody(required = false) SavingsRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        limiter.check(request);
        return service.deposit(member, body == null ? null : body.amount(), body == null ? null : body.days());
    }

    /**
     * 적금 찾기(만기 수령 또는 해지).
     *
     * @param body 적금 ID
     * @param request HTTP 요청
     * @return 적금 화면 값
     */
    @PostMapping("/withdraw")
    public SavingsViewDTO withdraw(@RequestBody(required = false) SavingsRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        UUID id;
        try { id = UUID.fromString(body == null || body.id() == null ? "" : body.id()); }
        catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid savings"); }
        return service.withdraw(member, id);
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }
}
