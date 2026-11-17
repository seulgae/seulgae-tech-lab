package kr.seulgae.techlab.lobby.guestbook;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * 로비 방명록 API. 쓰기는 다른 게시판과 같이 로그인(카카오 로그인이 켜져 있으면)과 쓰기 제한을 적용한다.
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
@RestController
@RequestMapping("/api/guestbook")
public class GuestbookController {
    public record WriteRequest(String title, String content) {}

    private final GuestbookService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public GuestbookController(GuestbookService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    @GetMapping
    public List<GuestbookStore.Entry> latest() { return service.latest(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GuestbookStore.Entry write(@RequestBody(required = false) WriteRequest body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        return service.write(body == null ? null : body.title(), body == null ? null : body.content(), author);
    }
}
