package kr.seulgae.techlab.meeting.agendas.dto;

import java.util.List;
import kr.seulgae.techlab.meeting.agendas.entity.*;

/**
 * 페이지 목록이다.
 * @param items 최신순 안건
 * @param hasMore 다음 페이지 여부
 * @author seulgae
 * @version 1.0, 안건 목록
 * @see "None"
 */
public record AgendaPageDTO(List<MeetingAgenda> items, boolean hasMore) {}
