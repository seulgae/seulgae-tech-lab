package kr.seulgae.techlab.office.desk.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.office.desk.dto.DeskViewDTO;
import kr.seulgae.techlab.office.desk.dto.JavaAnswerDTO;
import kr.seulgae.techlab.office.desk.service.DeskService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 내 자리 컴퓨터 API(로그인 회원 전용): 오늘 업무와 보상, 자바 printf 연습.
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see "None"
 */
@RestController
@RequestMapping("/api/desk")
public class DeskController {
    private final DeskService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public DeskController(DeskService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    /**
     * 오늘 업무·자바 문제.
     *
     * @param request HTTP 요청
     * @return 화면 값
     */
    @GetMapping
    public DeskViewDTO view(HttpServletRequest request) { return service.view(member(request)); }

    /**
     * 오늘 업무 보상 받기.
     *
     * @param request HTTP 요청
     * @return 화면 값
     */
    @PostMapping("/claim")
    public DeskViewDTO claim(HttpServletRequest request) {
        UUID member = member(request);
        limiter.check(request);
        return service.claim(member);
    }

    /**
     * 자바 printf 답 확인.
     * 글쓰기 제한(WriteRateLimiter: 연달아 5번, 이후 12초에 1번)은 걸지 않는다. 연습은 여러 번 고쳐 실행하는 게 정상이고,
     * 동전 보상은 서비스가 하루 3번으로 막는다. 대신 회원당 1초에 한 번만 받아 연타만 막는다.
     *
     * @param body 문제와 형식 문자열
     * @param request HTTP 요청
     * @return 출력·정답 여부
     */
    @PostMapping("/java")
    public JavaAnswerDTO answer(@RequestBody(required = false) JavaAnswerDTO body, HttpServletRequest request) {
        UUID member = member(request);
        long now = System.nanoTime();
        Long last = lastRun.put(member, now);
        if (last != null && now - last < 1_000_000_000L) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too fast");
        return service.answer(member, body == null ? null : body.problemId(), body == null ? null : body.format());
    }

    /* 회원별 마지막 실행 시각(연타 방지). 오래된 항목은 1만 명을 넘으면 비운다. */
    private final java.util.Map<UUID, Long> lastRun = java.util.Collections.synchronizedMap(new java.util.LinkedHashMap<>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(java.util.Map.Entry<UUID, Long> eldest) { return size() > 10_000; }
    });

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }
}
