package kr.seulgae.techlab.office.work.controller;

import kr.seulgae.techlab.office.work.dto.*;
import kr.seulgae.techlab.office.work.entity.*;
import kr.seulgae.techlab.office.work.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.inventory.service.InventoryService;
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

    private final WorkItemService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final InventoryService inventory;

    public WorkItemController(WorkItemService service, WriteRateLimiter limiter, AuthService auth, InventoryService inventory) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.inventory = inventory;
    }

    /** 일하기 전: 회원은 HP 3·피로도 5가 남아 있어야 한다(모자라면 423). */
    private void ensureFit(UUID author) { if (author != null) inventory.ensureFit(author); }

    /** 회원이 게시물을 등록하면 HP -3, 피로도 -5, 동전 10원(하루 10번까지, 도배 방지) */
    private void reward(UUID author) {
        if (author == null) return;
        try { inventory.spendWork(author); } catch (org.springframework.web.server.ResponseStatusException ignored) { /* 동시에 여러 글을 올려 모자라졌으면 넘어간다 */ }
        inventory.rewardWorkPost(author);
    }

    /** @param board QA, MAINTENANCE, OPERATION */
    @GetMapping
    public WorkBoardDTO board(@RequestParam String board) { return service.board(board); }

    @GetMapping("/{id}")
    public WorkThreadDTO thread(@PathVariable UUID id) { return service.thread(id); }

    @PostMapping("/qa")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkItem createQa(@RequestBody(required = false) QaRequestDTO body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        ensureFit(author);
        var created = service.createQa(body == null ? null : body.title(), body == null ? null : body.content(), author);
        reward(author);
        return created;
    }

    @PostMapping("/{id}/maintenance")
    public WorkThreadDTO maintain(@PathVariable UUID id, @RequestBody(required = false) MaintenanceRequestDTO body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        ensureFit(author);
        var thread = service.maintain(id, body == null ? null : body.content(), body == null ? null : body.guide(), body != null && Boolean.TRUE.equals(body.done()), author);
        reward(author);
        return thread;
    }

    @PostMapping("/{id}/operation")
    public WorkThreadDTO operate(@PathVariable UUID id, @RequestBody(required = false) OperationRequestDTO body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        if (body == null || body.approved() == null) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "approved must be true or false");
        ensureFit(author);
        var thread = service.operate(id, body.content(), body.approved(), author);
        reward(author);
        return thread;
    }
}
