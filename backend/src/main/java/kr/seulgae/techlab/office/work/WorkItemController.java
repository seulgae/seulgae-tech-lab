package kr.seulgae.techlab.office.work;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.inventory.InventoryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * 사무실 업무 게시판 API. 쓰기는 다른 게시판과 같이 로그인(카카오 로그인이 켜져 있으면)과 쓰기 제한을 적용한다.
 *
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
@RestController
@RequestMapping("/api/work-items")
public class WorkItemController {
    public record QaRequest(String title, String content) {}
    public record MaintenanceRequest(String content, String guide, Boolean done) {}
    public record OperationRequest(String content, Boolean approved) {}

    private final WorkItemService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final InventoryService inventory;

    public WorkItemController(WorkItemService service, WriteRateLimiter limiter, AuthService auth, InventoryService inventory) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.inventory = inventory;
    }

    /** 회원이 게시물을 등록하면 동전 10원(하루 10번까지, 도배 방지) */
    private void reward(UUID author) { if (author != null) inventory.rewardWorkPost(author); }

    /** @param board QA, MAINTENANCE, OPERATION */
    @GetMapping
    public WorkItemService.BoardView board(@RequestParam String board) { return service.board(board); }

    @GetMapping("/{id}")
    public WorkItemService.Thread thread(@PathVariable UUID id) { return service.thread(id); }

    @PostMapping("/qa")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkItem createQa(@RequestBody(required = false) QaRequest body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        var created = service.createQa(body == null ? null : body.title(), body == null ? null : body.content(), author);
        reward(author);
        return created;
    }

    @PostMapping("/{id}/maintenance")
    public WorkItemService.Thread maintain(@PathVariable UUID id, @RequestBody(required = false) MaintenanceRequest body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        var thread = service.maintain(id, body == null ? null : body.content(), body == null ? null : body.guide(), body != null && Boolean.TRUE.equals(body.done()), author);
        reward(author);
        return thread;
    }

    @PostMapping("/{id}/operation")
    public WorkItemService.Thread operate(@PathVariable UUID id, @RequestBody(required = false) OperationRequest body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        if (body == null || body.approved() == null) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "approved must be true or false");
        var thread = service.operate(id, body.content(), body.approved(), author);
        reward(author);
        return thread;
    }
}
