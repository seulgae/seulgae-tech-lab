package kr.seulgae.techlab.office.qa.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.office.qa.entity.QaTicket;

/**
 * QA 티켓 저장소 명세(구현: JdbcQaTicketRepository, 테스트: InMemoryQaTicketRepository).
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see "None"
 */
public interface QaTicketRepository {
    /**
     * 최근 티켓부터 읽는다.
     *
     * @param limit 최대 개수
     * @return 티켓 목록
     */
    List<QaTicket> recent(int limit);

    /**
     * 티켓 하나.
     *
     * @param id 티켓 ID
     * @return 티켓(없으면 빈 값)
     */
    Optional<QaTicket> find(UUID id);

    /**
     * 티켓을 등록한다(상태는 REGISTERED).
     *
     * @param author 등록한 회원(비회원이면 null)
     * @param title 제목
     * @param content 내용
     * @return 새 티켓 ID
     */
    UUID create(UUID author, String title, String content);

    /**
     * 상태를 바꾼다. 지금 상태가 from일 때만 바꿔, 동시에 두 사람이 눌러도 한 번만 넘어간다.
     *
     * @param id 티켓 ID
     * @param from 지금 상태
     * @param to 다음 상태
     * @return 바꿨으면 true
     */
    boolean move(UUID id, String from, String to);
}
