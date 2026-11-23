package kr.seulgae.techlab.auth.service.impl;

import kr.seulgae.techlab.admin.service.impl.*;
import kr.seulgae.techlab.auth.repository.impl.*;
import kr.seulgae.techlab.auth.service.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 회원 등급: 신청 규칙(더 높은 등급만, 사유 1~200자, 검토 중은 하나), 승인하면 등급이 오르고 관리자(3)는 관리자실에 들어간다.
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 */
class LevelServiceTest {
    private final InMemoryLevelRequestRepository store = new InMemoryLevelRequestRepository();
    private final LevelService levels = new LevelServiceImpl(store);
    private final UUID me = UUID.randomUUID(), boss = UUID.randomUUID();

    @Test void membersApplyForHigherLevelsWithAReason() {
        assertEquals(1, levels.level(me), "처음엔 일반 사용자");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> levels.apply(me, 1, "그냥")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> levels.apply(me, 4, "최고 관리자")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> levels.apply(me, 3, "  ")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> levels.apply(me, 3, "가".repeat(201))).getStatusCode().value());
        var request = levels.apply(me, 3, "  운영 DB 점검을 돕고 싶어요 ");
        assertEquals("운영 DB 점검을 돕고 싶어요", request.reason());
        assertEquals("PENDING", levels.mine(me).request().status());
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> levels.apply(me, 2, "운영자라도")).getStatusCode().value(), "검토 중 신청은 하나");
    }

    @Test void approvingRaisesTheLevelAndLevelThreeOpensTheAdminRoom() {
        var access = new AdminAccessImpl(null, store);
        assertFalse(access.isAdmin(me));
        var request = levels.apply(me, 3, "관리자실에 들어가고 싶어요");
        var approved = levels.decide(boss, request.id(), true);
        assertEquals("APPROVED", approved.status());
        assertEquals(3, levels.level(me));
        assertTrue(access.isAdmin(me), "관리자(3)는 관리자실에 들어간다");
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> levels.decide(boss, request.id(), false)).getStatusCode().value(), "이미 처리됨");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> levels.apply(me, 3, "또")).getStatusCode().value(), "이미 그 등급");
    }

    @Test void rejectedRequestsKeepTheLevelAndOperatorsAreNotAdmins() {
        var access = new AdminAccessImpl(null, store);
        var request = levels.apply(me, 2, "게시판 관리를 돕고 싶어요");
        levels.decide(boss, request.id(), false);
        assertEquals(1, levels.level(me));
        assertEquals("REJECTED", levels.mine(me).request().status());
        store.setLevel(me, 2);
        assertFalse(access.isAdmin(me), "운영자(2)는 관리자가 아니다");
    }
}
