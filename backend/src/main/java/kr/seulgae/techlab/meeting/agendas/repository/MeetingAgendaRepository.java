package kr.seulgae.techlab.meeting.agendas.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.common.write.Ownership;
import kr.seulgae.techlab.meeting.agendas.entity.*;

/**
 * MeetingAgendaRepository 저장소 명세(구현: JdbcMeetingAgendaRepository).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(저장소 인터페이스 분리)
 * @see "None"
 */
public interface MeetingAgendaRepository {
    /** 최신순 목록. 다음 페이지 여부 확인을 위해 호출자가 limit+1을 요청한다. */
    List<MeetingAgenda> list(int limit, int offset);

    /** @param authorId 로그인 회원 작성자, 로그인이 꺼져 있으면 null */
    MeetingAgenda create(String title, String content, String editTokenHash, UUID authorId);

    /** @return 수정 키 해시와 작성자, 행이 없으면 빈 Optional */
    Optional<Ownership> ownership(UUID id);

    MeetingAgenda update(UUID id, String title, String content);

    int delete(UUID id);
}
