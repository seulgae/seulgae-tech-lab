package kr.seulgae.techlab.dorm.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.dorm.dto.DormViewDTO;
import kr.seulgae.techlab.dorm.dto.FurnitureRequestDTO;
import kr.seulgae.techlab.dorm.dto.RestDTO;
import kr.seulgae.techlab.dorm.service.DormService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 개인 기숙사 가구 API. 로그인한 회원만, 자기 가구만 다룬다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
@RestController
@RequestMapping("/api/dorm")
public class DormController {
    private final DormService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public DormController(DormService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    /**
     * 내 동전·가구 카탈로그·내 가구.
     *
     * @param request HTTP 요청(로그인 세션)
     * @return 기숙사 화면 값
     */
    @GetMapping
    public DormViewDTO view(HttpServletRequest request) { return service.view(member(request)); }

    /**
     * 가구 구매(보관함으로).
     *
     * @param body 가구 코드
     * @param request HTTP 요청
     * @return 기숙사 화면 값
     */
    @PostMapping("/buy")
    public DormViewDTO buy(@RequestBody(required = false) FurnitureRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        limiter.check(request);
        return service.buy(member, body == null ? null : body.code());
    }

    /**
     * 가구 배치·옮기기.
     *
     * @param body 가구 ID와 위치
     * @param request HTTP 요청
     * @return 기숙사 화면 값
     */
    @PostMapping("/place")
    public DormViewDTO place(@RequestBody(required = false) FurnitureRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        return service.place(member, id(body), body.x(), body.y());
    }

    /**
     * 가구 보관(보관함으로 되돌리기).
     *
     * @param body 가구 ID
     * @param request HTTP 요청
     * @return 기숙사 화면 값
     */
    @PostMapping("/store")
    public DormViewDTO store(@RequestBody(required = false) FurnitureRequestDTO body, HttpServletRequest request) {
        return service.store(member(request), id(body));
    }

    /**
     * 침대 휴식(누워 있는 동안 간격마다 부른다. 간격은 서버가 지킨다).
     *
     * @param request HTTP 요청
     * @return 회복 결과
     */
    @PostMapping("/rest")
    public RestDTO rest(HttpServletRequest request) { return service.rest(member(request)); }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    private static UUID id(FurnitureRequestDTO body) {
        try { return UUID.fromString(body == null || body.id() == null ? "" : body.id()); }
        catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid furniture"); }
    }
}
