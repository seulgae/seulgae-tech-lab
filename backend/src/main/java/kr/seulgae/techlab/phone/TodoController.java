package kr.seulgae.techlab.phone;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 폰 캘린더 할 일 API. 로그인한 회원만, 자기 할 일만 쓴다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(캘린더)
 * @see "None"
 */
@RestController
@RequestMapping("/api/todos")
public class TodoController {
    public record AddRequest(String date, String title) {}
    public record DoneRequest(Boolean done) {}

    private final TodoService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public TodoController(TodoService service, WriteRateLimiter limiter, AuthService auth) {
        this.service = service; this.limiter = limiter; this.auth = auth;
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    /** 이 달(?month=YYYY-MM)의 내 할 일 */
    @GetMapping
    public List<TodoStore.Todo> month(@RequestParam(required = false) String month, HttpServletRequest request) {
        return service.month(member(request), month);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TodoStore.Todo add(@RequestBody(required = false) AddRequest body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        return service.add(member, body == null ? null : body.date(), body == null ? null : body.title());
    }

    @PatchMapping("/{id}")
    public TodoStore.Todo done(@PathVariable UUID id, @RequestBody(required = false) DoneRequest body, HttpServletRequest request) {
        return service.done(member(request), id, body == null ? null : body.done());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, HttpServletRequest request) { service.delete(member(request), id); }
}
