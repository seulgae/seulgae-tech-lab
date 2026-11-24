package kr.seulgae.techlab.office.idea.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.office.common.WorkReward;
import kr.seulgae.techlab.office.idea.dto.IdeaRequestDTO;
import kr.seulgae.techlab.office.idea.entity.IdeaPost;
import kr.seulgae.techlab.office.idea.service.IdeaPostService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * 아이디어 기획 게시판 API. 읽기는 누구나, 쓰기는 다른 게시판과 같이 로그인(카카오 로그인이 켜져 있으면)과 쓰기 제한을 적용한다.
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see "None"
 */
@RestController
@RequestMapping("/api/ideas")
public class IdeaPostController {
    private final IdeaPostService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final WorkReward work;

    public IdeaPostController(IdeaPostService service, WriteRateLimiter limiter, AuthService auth, WorkReward work) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.work = work;
    }

    /**
     * 최근 아이디어 50개.
     *
     * @return 글 목록
     */
    @GetMapping
    public List<IdeaPost> list() { return service.list(); }

    /**
     * 아이디어 쓰기(회원은 HP -3·기력 -5, 동전 10원).
     *
     * @param body 제목과 내용
     * @param request HTTP 요청
     * @return 새 글
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IdeaPost create(@RequestBody(required = false) IdeaRequestDTO body, HttpServletRequest request) {
        var author = auth.writer(request).orElse(null);
        limiter.check(request);
        work.ensureFit(author, kr.seulgae.techlab.rule.entity.ActionCost.IDEA_POST);
        var created = service.create(body == null ? null : body.title(), body == null ? null : body.content(), author);
        work.reward(author, kr.seulgae.techlab.rule.entity.ActionCost.IDEA_POST);
        return created;
    }
}
