package kr.seulgae.techlab.office.qa.dto;

/**
 * QA 요청: 등록은 title·content, 상태 변경은 status(IN_PROGRESS·RESOLVED).
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see None
 */
public record QaRequestDTO(String title, String content, String status) {}
