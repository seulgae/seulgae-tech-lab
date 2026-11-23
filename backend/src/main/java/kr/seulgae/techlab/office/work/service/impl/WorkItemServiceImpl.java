package kr.seulgae.techlab.office.work.service.impl;

import kr.seulgae.techlab.office.work.dto.*;
import kr.seulgae.techlab.office.work.entity.*;
import kr.seulgae.techlab.office.work.service.*;
import kr.seulgae.techlab.office.work.repository.*;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static kr.seulgae.techlab.office.work.entity.WorkItem.*;

/**
 * 사무실 업무 흐름: 1번 오피스 QA 등록 → 2번 오피스 유지보수 조치·가이드 → 4번 오피스 운영 점검·최종 승인(반려 시 2번으로).
 * 상태 전이는 모두 이 서비스에서만 일어난다(나중에 이벤트 발행을 붙일 지점).
 *
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
@Service
public class WorkItemServiceImpl implements WorkItemService {
    /** 게시판(카테고리)마다 "처리할 차례"인 QA 티켓 상태 */
    static final Map<String, Set<String>> INBOX = Map.of(
        QA, Set.of(),
        MAINTENANCE, Set.of(REGISTERED, IN_PROGRESS, REJECTED),
        OPERATION, Set.of(RESOLVED));
    static final int LIST_LIMIT = 50;


    private final WorkItemRepository store;

    public WorkItemServiceImpl(WorkItemRepository store) { this.store = store; }

    public WorkBoardDTO board(String board) {
        if (!INBOX.containsKey(board)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown board");
        var inbox = INBOX.get(board).isEmpty() ? List.<WorkItem>of() : store.tickets(INBOX.get(board), LIST_LIMIT);
        return new WorkBoardDTO(board, store.codes("WORK_CATEGORY"), store.codes("WORK_STATUS"), inbox, store.byCategory(board, LIST_LIMIT));
    }

    public WorkThreadDTO thread(UUID id) {
        var item = store.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Work item not found"));
        var ticket = item.parentId() == null ? item : store.find(item.parentId()).orElseThrow();
        return new WorkThreadDTO(ticket, store.children(ticket.id()));
    }

    /** 1번 오피스: QA 등록. 새 티켓은 "등록" 상태로 2번 유지보수 게시판에 올라간다. */
    @Transactional
    public WorkItem createQa(String title, String content, UUID author) {
        return store.insert(null, QA, REGISTERED, text(title, 60, "title"), text(content, 1000, "content"), null, author);
    }

    /** 2번 오피스: 조치 현황과 가이드를 남긴다. done이면 "조치 완료"로 4번 운영 점검에 넘긴다. */
    @Transactional
    public WorkThreadDTO maintain(UUID ticketId, String content, String guide, boolean done, UUID author) {
        var ticket = waitingTicket(ticketId, MAINTENANCE);
        String status = done ? RESOLVED : IN_PROGRESS;
        store.insert(ticket.id(), MAINTENANCE, status, ticket.title(), text(content, 1000, "content"), optional(guide, 1000), author);
        store.updateStatus(ticket.id(), status);
        return thread(ticket.id());
    }

    /** 4번 오피스: 정상 작동을 점검하고 최종 승인하거나, 반려해 2번 유지보수로 돌려보낸다. */
    @Transactional
    public WorkThreadDTO operate(UUID ticketId, String content, boolean approved, UUID author) {
        var ticket = waitingTicket(ticketId, OPERATION);
        String status = approved ? APPROVED : REJECTED;
        store.insert(ticket.id(), OPERATION, status, ticket.title(), text(content, 1000, "content"), null, author);
        store.updateStatus(ticket.id(), status);
        return thread(ticket.id());
    }

    private WorkItem waitingTicket(UUID id, String board) {
        var ticket = store.find(id).filter(item -> item.parentId() == null)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!INBOX.get(board).contains(ticket.status())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Ticket is not waiting for this board");
        return ticket;
    }

    private static String text(String value, int max, String field) {
        String stripped = value == null ? "" : value.strip();
        if (stripped.isEmpty() || stripped.codePointCount(0, stripped.length()) > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be 1-" + max + " characters");
        }
        return stripped;
    }

    private static String optional(String value, int max) {
        return value == null || value.isBlank() ? null : text(value, max, "guide");
    }
}
