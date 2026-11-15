package kr.seulgae.techlab.research.records.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 등록 요청의 필수 값과 최대 길이 제약을 검증한다.
 *
 * @author seulgae
 * @version 1.0, 등록 요청 검증 테스트 문서화
 * @see "None"
 */
class CreateResearchRequestTest {
    /**
     * 정상 입력은 허용하고 빈 값과 길이 초과 입력은 거부하는지 검증한다.
     */
    @Test void rejectsBlankAndOversizedFields() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertTrue(validator.validate(new CreateResearchRequest("title", "summary", "content")).isEmpty());
            assertEquals(3, validator.validate(new CreateResearchRequest(" ", "", "\n")).size());
            assertEquals(3, validator.validate(new CreateResearchRequest("t".repeat(121), "s".repeat(501), "c".repeat(20001))).size());
        }
    }
}
