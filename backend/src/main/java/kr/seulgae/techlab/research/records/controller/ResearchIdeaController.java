package kr.seulgae.techlab.research.records.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.IdeaRequest;
import kr.seulgae.techlab.research.records.service.ResearchIdeaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 로비 연구 기록 컴퓨터에서 쓰는 연구 아이디어 일지 API이다. 운영에서도 열려 있으며
 * 쓰기는 {@link WriteRateLimiter}로 제한하고, 수정·삭제는 {@code X-Edit-Token} 헤더의 수정 키가 있어야 한다.
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

    public ResearchIdeaController(ResearchIdeaService service, WriteRateLimiter limiter, AuthService auth) { this.service = service; this.limiter = limiter; this.auth = auth; }

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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestHeader(name = "X-Edit-Token", required = false) String token,
                                       HttpServletRequest request) {
        var member = auth.writer(request);
        limiter.check(request);
        service.delete(id, token, member);
        return ResponseEntity.noContent().build();
    }
}
