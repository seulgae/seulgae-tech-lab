package kr.seulgae.techlab.research.records.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.IdeaRequest;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import kr.seulgae.techlab.research.records.service.ResearchIdeaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로비 연구 기록 컴퓨터에서 쓰는 연구 아이디어 일지 API이다. 운영에서도 열려 있으며
 * 쓰기는 {@link WriteRateLimiter}로 제한하고, 수정·삭제는 {@code X-Edit-Token} 헤더의 수정 키가 있어야 한다.
 * 완료 체크는 누구나 할 수 있는 공유 상태라 권한 확인 없이 쓰기 제한만 적용한다.
 *
 * @author seulgae
 * @version 1.0, 아이디어 일지 작성·수정·삭제
 * @see "None"
 */
@RestController
@RequestMapping("/api/research-records")
public class ResearchIdeaController {
    private final ResearchIdeaService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final ResearchRepository repository;

    public ResearchIdeaController(ResearchIdeaService service, WriteRateLimiter limiter, AuthService auth, ResearchRepository repository) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.repository = repository;
    }

    /** @return {"number": 다음 일지 번호} */
    @GetMapping("/ideas/next-number")
    public Map<String, Integer> nextNumber() { return Map.of("number", service.nextNumber()); }

    /** @return 201, 생성된 기록과 수정 키 */
    @PostMapping("/ideas")
    public ResponseEntity<ResearchIdeaService.Created> create(@RequestBody(required = false) IdeaRequest body, HttpServletRequest request) {
        var author = auth.writer(request);
        limiter.check(request);
        var created = service.create(body, author);
        return ResponseEntity.created(URI.create("/api/research-records/" + created.record().id())).body(created);
    }

    @PutMapping("/{id}")
    public ResearchRecord update(@PathVariable UUID id, @RequestBody(required = false) IdeaRequest body,
                                 @RequestHeader(name = "X-Edit-Token", required = false) String token, HttpServletRequest request) {
        var member = auth.writer(request);
        limiter.check(request);
        return service.update(id, body, token, member);
    }

    /** 완료 체크 요청 본문 */
    public record DoneRequest(Boolean done) { }

    /**
     * 완료 표시를 바꾼다. 로그인·수정 키 없이 누구나 체크·해제할 수 있고, 쓰기 제한만 적용한다.
     * @return {"id": 기록 ID, "done": 바뀐 값}
     */
    @PutMapping("/{id}/done")
    public Map<String, Object> done(@PathVariable UUID id, @RequestBody(required = false) DoneRequest body, HttpServletRequest request) {
        if (body == null || body.done() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "done must be true or false");
        limiter.check(request);
        if (repository.setDone(id, body.done()) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Research record not found");
        return Map.of("id", id, "done", body.done());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestHeader(name = "X-Edit-Token", required = false) String token,
                                       HttpServletRequest request) {
        var member = auth.writer(request);
        limiter.check(request);
        service.delete(id, token, member);
        return ResponseEntity.noContent().build();
    }
}
