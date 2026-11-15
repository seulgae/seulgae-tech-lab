package kr.seulgae.techlab.research.records.controller;

import jakarta.validation.Valid;
import java.net.URI;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.CreateResearchRequest;
import kr.seulgae.techlab.research.records.service.ResearchService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// No authentication yet: production has no write route. Enable only for localhost development.
/**
 * 쓰기 기능이 명시적으로 활성화된 개발 환경에서 연구 기록을 등록한다.
 *
 * @author seulgae
 * @version 1.0, 개발용 등록 API와 활성화 조건 문서화
 * @see "None"
 */
@RestController
@RequestMapping("/api/research-records")
@ConditionalOnProperty(name = "lab.research.write-enabled", havingValue = "true")
public class ResearchWriteController {
    private final ResearchService service;
    /**
     * 등록 요청 처리를 위한 연구 기록 서비스를 주입받는다.
     *
     * @param service 연구 기록 서비스
     */
    public ResearchWriteController(ResearchService service) { this.service = service; }

    /**
     * 검증된 요청으로 연구 기록을 등록하고 생성된 위치를 반환한다.
     *
     * @param request 검증을 거친 등록 요청
     * @return 생성된 기록과 Location 헤더를 담은 201 응답
     */
    @PostMapping
    public ResponseEntity<ResearchRecord> create(@Valid @RequestBody CreateResearchRequest request) {
        var record = service.create(request);
        return ResponseEntity.created(URI.create("/api/research-records/" + record.id())).body(record);
    }
}
