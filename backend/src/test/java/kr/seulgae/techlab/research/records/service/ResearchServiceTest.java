package kr.seulgae.techlab.research.records.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.domain.ResearchSummary;
import kr.seulgae.techlab.research.records.dto.CreateResearchRequest;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 연구 기록 서비스의 페이지 경계와 입력 정리 동작을 검증한다.
 *
 * @author seulgae
 * @version 1.0, 서비스 회귀 검증 의도 문서화
 * @see "None"
 */
class ResearchServiceTest {
    private final ResearchRepository repository = mock(ResearchRepository.class);
    private final ResearchService service = new ResearchService(repository);

    /**
     * 추가 조회 행이 있으면 요청한 개수만 반환하고 다음 페이지를 표시하는지 검증한다.
     */
    @Test void returnsOnlyRequestedItemsAndReportsNextPage() {
        var first = summary("first");
        var second = summary("second");
        when(repository.list(2, 10)).thenReturn(List.of(first, second));

        var page = service.list(1, 10);

        assertEquals(List.of(first), page.items());
        assertTrue(page.hasMore());
        verify(repository).list(2, 10);
    }

    /**
     * 마지막 페이지와 빈 결과에서 다음 페이지가 없다고 표시하는지 검증한다.
     */
    @Test void doesNotReportNextPageWithoutAnExtraRecord() {
        var last = summary("last");
        when(repository.list(2, 0)).thenReturn(List.of(last));
        assertFalse(service.list(1, 0).hasMore());

        when(repository.list(2, 0)).thenReturn(List.of());
        var empty = service.list(1, 0);
        assertTrue(empty.items().isEmpty());
        assertFalse(empty.hasMore());
    }

    /**
     * 등록 전에 제목·요약·본문의 앞뒤 공백을 제거하는지 검증한다.
     */
    @Test void preservesWhitespaceNormalizationBeforePersistence() {
        var record = new ResearchRecord(UUID.randomUUID(), "title", "summary", "content", OffsetDateTime.now());
        when(repository.create("title", "summary", "content")).thenReturn(record);

        assertEquals(record, service.create(new CreateResearchRequest(" title ", "\nsummary\t", " content\n")));
        verify(repository).create("title", "summary", "content");
    }

    /**
     * 테스트에 사용할 연구 기록 요약을 생성한다.
     *
     * @param title 테스트용 제목
     * @return 임의 식별자와 작성 시각을 가진 요약
     */
    private static ResearchSummary summary(String title) {
        return new ResearchSummary(UUID.randomUUID(), title, "summary", OffsetDateTime.now(), false);
    }
}
