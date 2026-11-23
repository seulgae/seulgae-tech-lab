package kr.seulgae.techlab.meeting.agendas.entity;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 회의실 화이트보드 안건이다. 수정 키 해시는 응답에 포함하지 않는다.
 *
 * @param id 안건 식별자
 * @param title 칠판에 보이는 8자 이하 제목
 * @param content 130자 이하 내용
 * @param createdAt 작성 시각
 * @param updatedAt 마지막 수정 시각, 수정 전이면 null
 * @author seulgae
 * @version 1.0, 회의 안건
 * @see "None"
 */
public record MeetingAgenda(UUID id, String title, String content, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
