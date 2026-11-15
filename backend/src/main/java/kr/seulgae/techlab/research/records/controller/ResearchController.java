package kr.seulgae.techlab.research.records.controller;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.ResearchPage;
import kr.seulgae.techlab.research.records.service.ResearchService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 공통 연구 기록의 목록과 상세 조회 HTTP 요청을 처리한다.
 *
 * @author seulgae
 * @version 1.0, 연구 기록 조회 API 책임 문서화
 * @see "None"
 */
@RestController
@RequestMapping("/api/research-records")
public class ResearchController {
    private final ResearchService service;
    /**
     * 조회 요청 처리를 위한 연구 기록 서비스를 주입받는다.
     *
     * @param service 연구 기록 서비스
     */
    public ResearchController(ResearchService service) { this.service = service; }

    /**
     * 지정한 범위의 연구 기록 요약과 다음 페이지 여부를 조회한다.
     *
     * @param limit 페이지 크기, 1~50
     * @param offset 건너뛸 기록 수, 0~10,000
     * @return 연구 기록 요약 페이지
     */
    @GetMapping
    public ResearchPage list(@RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
                             @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int offset) {
        return service.list(limit, offset);
    }

    /**
     * 식별자에 해당하는 연구 기록 상세를 조회한다.
     *
     * @param id 기록 식별자
     * @return 연구 기록 상세
     * @throws ResponseStatusException 기록이 없으면 404 응답으로 변환되는 예외
     */
    @GetMapping("/{id}")
    public ResearchRecord find(@PathVariable UUID id) {
        return service.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Research record not found"));
    }
}
