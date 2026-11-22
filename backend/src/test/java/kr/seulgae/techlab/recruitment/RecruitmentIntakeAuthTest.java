package kr.seulgae.techlab.recruitment;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 외부 접수 전용 토큰과 관리자 상태 변경 권한이 섞이지 않도록 접수 인증을 검증한다.
 * @author seulgae
 * @version 1.0, 외부 공고 등록 인증
 * @see "None"
 */
class RecruitmentIntakeAuthTest {
    @Test void absentAndIncorrectTokensCannotRegister() {
        var inbox=mock(RecruitmentInbox.class);
        var jobs=new RecruitmentJobs(null,inbox,true);
        var payload=JsonMapper.builder().build().createArrayNode();
        var disabled=new RecruitmentIntakeController(inbox,jobs,"");
        assertEquals(503,assertThrows(ResponseStatusException.class,()->disabled.ingest(null,payload)).getStatusCode().value());
        String token="test-only-not-a-real-secret-key-000000";
        var enabled=new RecruitmentIntakeController(inbox,jobs,token);
        assertEquals(401,assertThrows(ResponseStatusException.class,()->enabled.ingest("Bearer wrong",payload)).getStatusCode().value());
        enabled.ingest("Bearer "+token,payload);
        verify(inbox).ingest(payload);
        verifyNoMoreInteractions(inbox);
    }
}
