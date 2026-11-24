package kr.seulgae.techlab.office.idea.dto;

/**
 * 아이디어 글 쓰기 요청: 제목(1~60자)과 내용(1~1000자).
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see "None"
 */
public record IdeaRequestDTO(String title, String content) {}
