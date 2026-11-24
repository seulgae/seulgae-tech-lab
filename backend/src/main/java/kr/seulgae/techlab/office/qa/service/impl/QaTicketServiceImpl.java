package kr.seulgae.techlab.office.qa.service.impl;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.office.qa.entity.QaTicket;
import kr.seulgae.techlab.office.qa.repository.QaTicketRepository;
import kr.seulgae.techlab.office.qa.service.QaTicketService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * QA 게시판 구현. 상태는 지금보다 뒤 단계로만 옮길 수 있다(등록 → 조치 완료로 바로 건너뛰는 것도 허용).
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see "None"
 */
@Service
public class QaTicketServiceImpl implements QaTicketService {
    private final QaTicketRepository tickets;

    public QaTicketServiceImpl(QaTicketRepository tickets) { this.tickets = tickets; }

    @Override public List<QaTicket> list() { return tickets.recent(LIST_LIMIT); }

    @Override
    @Transactional
    public QaTicket create(String title, String content, UUID author) {
        UUID id = tickets.create(author, text(title, TITLE_MAX, "title"), text(content, CONTENT_MAX, "content"));
        return tickets.find(id).orElseThrow();
    }

    @Override
    @Transactional
    public QaTicket move(UUID id, String status) {
        int next = status == null ? -1 : FLOW.indexOf(status);
        if (next <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be IN_PROGRESS or RESOLVED");
        QaTicket ticket = tickets.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        /* 앞으로만 간다. 같은 순간 다른 사람이 먼저 바꿨으면 move가 실패한다. */
        if (FLOW.indexOf(ticket.status()) >= next || !tickets.move(id, ticket.status(), status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ticket already moved");
        }
        return tickets.find(id).orElseThrow();
    }

    /**
     * 공백을 다듬고 1~max자인지 확인한다.
     *
     * @param value 입력
     * @param max 최대 글자 수
     * @param field 필드 이름(오류 문구)
     * @return 다듬은 값
     * @exception ResponseStatusException 비었거나 너무 길면 400
     */
    static String text(String value, int max, String field) {
        String trimmed = value == null ? "" : value.strip();
        if (trimmed.isEmpty() || trimmed.codePointCount(0, trimmed.length()) > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be 1-" + max + " characters");
        return trimmed;
    }
}
