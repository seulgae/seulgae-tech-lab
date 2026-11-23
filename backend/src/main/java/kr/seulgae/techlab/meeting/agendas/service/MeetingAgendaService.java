package kr.seulgae.techlab.meeting.agendas.service;

import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.meeting.agendas.dto.*;
import kr.seulgae.techlab.meeting.agendas.entity.*;

/**
 * MeetingAgendaService 기능 명세(구현: MeetingAgendaServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface MeetingAgendaService {
    /** 화이트보드 필기 영역(약 100px)에 12px 글자로 한 줄에 들어가는 길이 */
    int TITLE_MAX = 8;
    int CONTENT_MAX = 130;

    AgendaPageDTO list(int limit, int offset);

    /** @param author 로그인 회원(로그인이 꺼져 있으면 빈 값) */
    AgendaCreatedDTO create(AgendaRequestDTO request, Optional<UUID> author);

    MeetingAgenda update(UUID id, AgendaRequestDTO request, String token, Optional<UUID> member);

    void delete(UUID id, String token, Optional<UUID> member);
}
