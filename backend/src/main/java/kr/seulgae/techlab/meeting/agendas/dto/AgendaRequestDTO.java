package kr.seulgae.techlab.meeting.agendas.dto;

/**
 * 안건 요청 본문이다.
 * @param title 제목
 * @param content 내용
 * @author seulgae
 * @version 1.0, 안건 입력
 * @see "None"
 */
public record AgendaRequestDTO(String title, String content) {}
