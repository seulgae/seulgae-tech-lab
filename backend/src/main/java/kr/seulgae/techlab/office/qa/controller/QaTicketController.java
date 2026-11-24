package kr.seulgae.techlab.office.qa.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.office.common.WorkReward;
import kr.seulgae.techlab.office.qa.dto.QaRequestDTO;
import kr.seulgae.techlab.office.qa.entity.QaTicket;
import kr.seulgae.techlab.office.qa.service.QaTicketService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * QA 게시판 API. 읽기는 누구나, 등록·상태 변경은 다른 게시판과 같이 로그인(카카오 로그인이 켜져 있으면)과 쓰기 제한을 적용한다.
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see "None"
 */
@RestController
@RequestMapping("/api/qa")
public class QaTicketController {
    private final QaTicketService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final WorkReward work;

    public QaTicketController(QaTicketService service, WriteRateLimiter limiter, AuthService auth, WorkReward work) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.work = work;
    }

    /**
     * 최근 티켓 50개.
     *
     * @return 티켓 목록
     */
    @GetMapping
    public List<QaTicket> list() { return service.list(); }

    /**
     * 티켓 등록(회원은 HP -3·기력 -5, 동전 10원).
     *
     * @param body 제목과 내용
     * @param request HTTP 요청
     * @return 새 티켓
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QaTicket create(@RequestBody(required = false) QaRequestDTO body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        work.ensureFit(author, kr.seulgae.techlab.rule.entity.ActionCost.QA_REGISTER);
        var created = service.create(body == null ? null : body.title(), body == null ? null : body.content(), author);
        work.reward(author, kr.seulgae.techlab.rule.entity.ActionCost.QA_REGISTER);
        return created;
    }

    /**
     * 상태 바꾸기: 조치 중·조치 완료(회원은 HP -3·기력 -5, 동전 10원).
     *
     * @param id 티켓 ID
     * @param body 바꿀 상태
     * @param request HTTP 요청
     * @return 바뀐 티켓
     */
    @PostMapping("/{id}/status")
    public QaTicket move(@PathVariable UUID id, @RequestBody(required = false) QaRequestDTO body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        work.ensureFit(author, kr.seulgae.techlab.rule.entity.ActionCost.QA_MOVE);
        var moved = service.move(id, body == null ? null : body.status());
        work.reward(author, kr.seulgae.techlab.rule.entity.ActionCost.QA_MOVE);
        return moved;
    }
}
