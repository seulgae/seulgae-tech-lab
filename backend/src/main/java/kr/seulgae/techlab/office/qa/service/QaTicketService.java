package kr.seulgae.techlab.office.qa.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.office.qa.entity.QaTicket;

/**
 * QA 게시판 명세(구현: QaTicketServiceImpl). 티켓은 등록 → 조치 중 → 조치 완료로만 진행하고 되돌리지 않는다.
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see "None"
 */
public interface QaTicketService {
    /** 진행 순서(공통코드 QA_STATUS) */
    List<String> FLOW = List.of("REGISTERED", "IN_PROGRESS", "RESOLVED");
    int TITLE_MAX = 60, CONTENT_MAX = 1000, LIST_LIMIT = 50;

    /**
     * 최근 티켓 목록.
     *
     * @return 최대 50개
     */
    List<QaTicket> list();

    /**
     * 티켓을 등록한다.
     *
     * @param title 제목
     * @param content 내용
     * @param author 등록한 회원(비회원이면 null)
     * @return 새 티켓
     * @exception org.springframework.web.server.ResponseStatusException 제목·내용 길이가 틀리면 400
     */
    QaTicket create(String title, String content, UUID author);

    /**
     * 티켓을 다음 상태로 옮긴다(앞으로만).
     *
     * @param id 티켓 ID
     * @param status 바꿀 상태(IN_PROGRESS·RESOLVED)
     * @return 바뀐 티켓
     * @exception org.springframework.web.server.ResponseStatusException 모르는 상태 400, 없는 티켓 404, 뒤로 가거나 이미 바뀌었으면 409
     */
    QaTicket move(UUID id, String status);
}
