package kr.seulgae.techlab.office.work.repository;

import kr.seulgae.techlab.office.work.entity.*;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 업무 게시판 저장소. 운영은 PostgreSQL(JdbcWorkItemRepository), DB 없는 로컬·테스트는 메모리 구현을 쓴다.
 *
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
public interface WorkItemRepository {

    List<CommonCode> codes(String group);
    /** 카테고리 기록, 최신순 */
    List<WorkItem> byCategory(String category, int limit);
    /** 상태가 statuses 중 하나인 QA 티켓, 최신순 */
    List<WorkItem> tickets(Collection<String> statuses, int limit);
    Optional<WorkItem> find(UUID id);
    /** 티켓에 연결된 유지보수·운영 기록, 작성순 */
    List<WorkItem> children(UUID ticketId);
    WorkItem insert(UUID parentId, String category, String status, String title, String content, String guide, UUID authorId);
    void updateStatus(UUID ticketId, String status);
}
