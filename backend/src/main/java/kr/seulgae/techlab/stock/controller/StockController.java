package kr.seulgae.techlab.stock.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.stock.dto.StockTradeRequestDTO;
import kr.seulgae.techlab.stock.dto.StockViewDTO;
import kr.seulgae.techlab.stock.service.StockService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 주식 앱 API. 로그인한 회원만 쓴다.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
@RestController
@RequestMapping("/api/stocks")
public class StockController {
    private final StockService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public StockController(StockService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    /**
     * 시세·내 주식·동전.
     *
     * @param request HTTP 요청
     * @return 주식 화면 값
     */
    @GetMapping
    public StockViewDTO view(HttpServletRequest request) { return service.view(member(request)); }

    /**
     * 매수.
     *
     * @param body 종목과 수량
     * @param request HTTP 요청
     * @return 주식 화면 값
     */
    @PostMapping("/buy")
    public StockViewDTO buy(@RequestBody(required = false) StockTradeRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        limiter.check(request);
        return service.buy(member, body == null ? null : body.code(), body == null ? null : body.quantity());
    }

    /**
     * 매도.
     *
     * @param body 종목과 수량
     * @param request HTTP 요청
     * @return 주식 화면 값
     */
    @PostMapping("/sell")
    public StockViewDTO sell(@RequestBody(required = false) StockTradeRequestDTO body, HttpServletRequest request) {
        UUID member = member(request);
        limiter.check(request);
        return service.sell(member, body == null ? null : body.code(), body == null ? null : body.quantity());
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }
}
