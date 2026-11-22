package kr.seulgae.techlab.phone;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.admin.AdminAccess;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 폰 SNS API. 읽기는 누구나, 쓰기·지우기는 로그인한 회원만(지우기는 내 글, 관리자는 모든 글).
 *
 * @author seulgae
 * @version 1.0, 폰 앱(SNS)
 * @see "None"
 */
@RestController
@RequestMapping("/api/sns")
public class SnsController {
    public record WriteRequest(String content) {}

    private final SnsService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final AdminAccess admins;

    public SnsController(SnsService service, WriteRateLimiter limiter, AuthService auth, AdminAccess admins) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.admins = admins;
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    /** 최근 글 50개 */
    @GetMapping
    public List<SnsService.View> latest(HttpServletRequest request) {
        return service.latest(auth.current(request).map(member -> member.id()).orElse(null));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SnsService.View write(@RequestBody(required = false) WriteRequest body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        return service.write(member, body == null ? null : body.content());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, HttpServletRequest request) {
        var member = member(request);
        service.delete(member, id, admins.isAdmin(member));
    }
}
