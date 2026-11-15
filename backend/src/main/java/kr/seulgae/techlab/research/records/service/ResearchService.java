package kr.seulgae.techlab.research.records.service;

import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.CreateResearchRequest;
import kr.seulgae.techlab.research.records.dto.ResearchPage;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import org.springframework.stereotype.Service;

/**
 * 공통 연구 기록의 페이지 구성과 등록 입력 정리를 담당한다.
 *
 * @author seulgae
 * @version 1.0, HTTP 처리와 JDBC 접근 사이의 서비스 책임 문서화
 * @see "None"
 */
@Service
public class ResearchService {
    private final ResearchRepository repository;

    /**
     * 연구 기록 저장소를 주입받는다.
     *
     * @param repository 연구 기록 저장소
     */
    public ResearchService(ResearchRepository repository) { this.repository = repository; }

    /**
     * 한 건을 추가 조회해 다음 페이지 여부를 판단하고 요청한 개수만 반환한다.
     *
     * @param limit 반환할 최대 기록 수
     * @param offset 건너뛸 기록 수
     * @return 연구 기록 요약 페이지
     */
    public ResearchPage list(int limit, int offset) {
        var records = repository.list(limit + 1, offset);
        return new ResearchPage(records.stream().limit(limit).toList(), records.size() > limit);
    }

    /**
     * 기록 식별자로 상세를 조회하며 존재하지 않으면 빈 결과를 반환한다.
     *
     * @param id 기록 식별자
     * @return 기록 상세 또는 빈 Optional
     */
    public Optional<ResearchRecord> find(UUID id) {
        return repository.find(id);
    }

    /**
     * 등록할 문자열의 앞뒤 공백을 제거한 뒤 저장한다.
     *
     * @param request 컨트롤러에서 검증한 등록 요청
     * @return 저장된 연구 기록
     */
    public ResearchRecord create(CreateResearchRequest request) {
        return repository.create(request.title().strip(), request.summary().strip(), request.content().strip());
    }
}
