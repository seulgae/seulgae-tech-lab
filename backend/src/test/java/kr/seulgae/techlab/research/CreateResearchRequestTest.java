package kr.seulgae.techlab.research;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CreateResearchRequestTest {
    @Test void rejectsBlankAndOversizedFields() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertTrue(validator.validate(new CreateResearchRequest("title", "summary", "content")).isEmpty());
            assertEquals(3, validator.validate(new CreateResearchRequest(" ", "", "\n")).size());
            assertEquals(3, validator.validate(new CreateResearchRequest("t".repeat(121), "s".repeat(501), "c".repeat(20001))).size());
        }
    }
}
