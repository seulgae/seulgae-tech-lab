package kr.seulgae.techlab.inventory;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 폰 은행 앱 API. 로그인한 회원만 쓴다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(은행)
 * @see "None"
 */
@RestController
@RequestMapping("/api/bank")
public class BankController {
    public record TransferRequest(String to, Integer amount) {}

    private final BankService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public BankController(BankService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    /** 잔액·오늘 남은 송금 횟수·최근 거래 30건 */
    @GetMapping
    public BankService.View view(HttpServletRequest request) { return service.view(member(request)); }

    /** 닉네임으로 받을 사람 찾기(최대 10명) */
    @GetMapping("/members")
    public List<InventoryStore.Recipient> members(@RequestParam(required = false) String q, HttpServletRequest request) {
        return service.search(member(request), q);
    }

    /** 송금(1~100원, 하루 10번) */
    @PostMapping("/transfer")
    public BankService.View transfer(@RequestBody(required = false) TransferRequest body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        UUID to;
        try { to = UUID.fromString(body == null || body.to() == null ? "" : body.to()); }
        catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recipient"); }
        return service.transfer(member, to, body.amount());
    }
}
