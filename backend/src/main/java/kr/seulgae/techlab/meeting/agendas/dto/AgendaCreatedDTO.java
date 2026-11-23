package kr.seulgae.techlab.meeting.agendas.dto;

import kr.seulgae.techlab.meeting.agendas.entity.*;

/**
 * 생성된 안건과 작성 브라우저에만 한 번 주는 수정 키이다.
 * @param agenda 안건
 * @param editToken 수정 키
 * @author seulgae
 * @version 1.0, 작성 응답
 * @see "None"
 */
public record AgendaCreatedDTO(MeetingAgenda agenda, String editToken) {}
