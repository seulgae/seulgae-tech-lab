package kr.seulgae.techlab.meeting.agendas;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import java.util.UUID;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 회의실 화이트보드 안건 API이다. 목록은 누구나 볼 수 있고, 쓰기는 속도 제한과 수정 키로 보호한다.
 *
 * @author seulgae
 * @version 1.0, 회의 안건 조회·작성·수정·삭제
 * @see "None"
 */
@RestController
@RequestMapping("/api/meeting-agendas")
public class MeetingAgendaController {
    private final MeetingAgendaService service;
    private final WriteRateLimiter limiter;
    public MeetingAgendaController(MeetingAgendaService service, WriteRateLimiter limiter) { this.service = service; this.limiter = limiter; }

    @GetMapping
    public MeetingAgendaService.Page list(@RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
                                          @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int offset) {
        return service.list(limit, offset);
    }

    @PostMapping
    public ResponseEntity<MeetingAgendaService.Created> create(@RequestBody(required = false) MeetingAgendaService.Request body, HttpServletRequest request) {
        limiter.check(request);
        var created = service.create(body);
        return ResponseEntity.created(URI.create("/api/meeting-agendas/" + created.agenda().id())).body(created);
    }

    @PutMapping("/{id}")
    public MeetingAgenda update(@PathVariable UUID id, @RequestBody(required = false) MeetingAgendaService.Request body,
                                @RequestHeader(name = "X-Edit-Token", required = false) String token, HttpServletRequest request) {
        limiter.check(request);
        return service.update(id, body, token);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestHeader(name = "X-Edit-Token", required = false) String token,
                                       HttpServletRequest request) {
        limiter.check(request);
        service.delete(id, token);
        return ResponseEntity.noContent().build();
    }
}
