package kr.seulgae.techlab.office.work;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 업무 흐름: 1번 QA 등록 → 2번 유지보수 조치·가이드 → 4번 운영 점검·최종 승인/반려, 게시판별 목록.
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
class WorkItemServiceTest {
    private final WorkItemService service = new WorkItemService(new InMemoryWorkStore());

    @Test void qaFlowsThroughMaintenanceToFinalApproval() {
        var qa = service.createQa("  로그인 버튼 안 눌림 ", "모바일에서 로그인 버튼이 반응하지 않아요", null);
        assertEquals("QA", qa.category());
        assertEquals("REGISTERED", qa.status());
        assertEquals("로그인 버튼 안 눌림", qa.title());
        assertEquals(1, service.board("QA").entries().size(), "1번 QA 게시판에 보인다");
        assertEquals(qa.id(), service.board("MAINTENANCE").inbox().get(0).id(), "2번 유지보수 게시판의 처리 대상");
        assertTrue(service.board("OPERATION").inbox().isEmpty(), "아직 운영 점검 대상은 아니다");

        service.maintain(qa.id(), "원인 확인 중", null, false, null);
        assertEquals("IN_PROGRESS", service.thread(qa.id()).ticket().status());
        assertThrows(ResponseStatusException.class, () -> service.operate(qa.id(), "점검", true, null), "조치 완료 전에는 승인할 수 없다");

        var resolved = service.maintain(qa.id(), "터치 영역을 넓혔어요", "새로고침 후 다시 눌러 보세요", true, null);
        assertEquals("RESOLVED", resolved.ticket().status());
        assertEquals("새로고침 후 다시 눌러 보세요", resolved.records().get(1).guide());
        assertTrue(service.board("MAINTENANCE").inbox().isEmpty());
        assertEquals(qa.id(), service.board("OPERATION").inbox().get(0).id(), "4번 운영 게시판의 점검 대상");
        assertEquals(2, service.board("MAINTENANCE").entries().size(), "유지보수 게시판에는 조치 기록만");

        var rejected = service.operate(qa.id(), "아직 아이폰에서 안 돼요", false, null);
        assertEquals("REJECTED", rejected.ticket().status());
        assertEquals(qa.id(), service.board("MAINTENANCE").inbox().get(0).id(), "반려되면 다시 유지보수로");

        service.maintain(qa.id(), "아이폰 사파리도 수정", "캐시를 지우고 확인", true, null);
        var approved = service.operate(qa.id(), "모든 기기에서 정상 동작 확인", true, null);
        assertEquals("APPROVED", approved.ticket().status());
        assertEquals(List.of("MAINTENANCE", "MAINTENANCE", "OPERATION", "MAINTENANCE", "OPERATION"),
            approved.records().stream().map(WorkItem::category).toList());
        assertEquals(2, service.board("OPERATION").entries().size());
        assertTrue(service.board("OPERATION").inbox().isEmpty());
        assertThrows(ResponseStatusException.class, () -> service.maintain(qa.id(), "또 조치", null, true, null), "승인된 티켓은 다시 조치하지 않는다");
    }

    @Test void validatesTextBoardAndTicket() {
        assertThrows(ResponseStatusException.class, () -> service.createQa(" ", "내용", null));
        assertThrows(ResponseStatusException.class, () -> service.createQa("제목", "가".repeat(1001), null));
        assertThrows(ResponseStatusException.class, () -> service.board("ARCADE"));
        assertThrows(ResponseStatusException.class, () -> service.maintain(UUID.randomUUID(), "조치", null, true, null));
        var qa = service.createQa("제목", "내용", null);
        var record = service.maintain(qa.id(), "조치", null, false, null).records().get(0);
        assertEquals(qa.id(), service.thread(record.id()).ticket().id(), "기록 id로 열어도 티켓 전체를 보여 준다");
        assertThrows(ResponseStatusException.class, () -> service.maintain(record.id(), "기록에 조치", null, true, null), "기록이 아니라 티켓에만 조치한다");
        assertEquals(3, service.board("QA").categories().size());
        assertEquals(5, service.board("QA").statuses().size());
    }
}
