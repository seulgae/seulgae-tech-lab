package kr.seulgae.techlab.gamble.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.gamble.dto.GambleRequestDTO;
import kr.seulgae.techlab.gamble.dto.GambleResultDTO;
import kr.seulgae.techlab.gamble.service.GambleService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 오락실 내기 게임 API. 로그인한 회원만 동전을 건다.
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see "None"
 */
@RestController
@RequestMapping("/api/gamble")
public class GambleController {
    private final GambleService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public GambleController(GambleService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    /**
     * 오늘 남은 판 수.
     *
     * @param request HTTP 요청
     * @return {"betsLeftToday": n}
     */
    @GetMapping
    public Map<String, Integer> status(HttpServletRequest request) { return Map.of("betsLeftToday", service.betsLeft(member(request))); }

    /**
     * 한 판.
     *
     * @param body 게임·건 동전·고른 값
     * @param request HTTP 요청
     * @return 결과
     */
    @PostMapping("/play")
    public GambleResultDTO play(@RequestBody(required = false) GambleRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        limiter.check(request);
        if (body == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        return service.play(member, body.game(), body.bet(), body.pick());
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }
}
