package kr.seulgae.techlab.research.records.dto;

/**
 * 연구 아이디어 일지 작성·수정 요청이다. 길이·문자 검증은 코드 포인트 기준으로 서비스에서 한다.
 *
 * @param title 한 줄 제목, 최대 40자 (예: 연구 아이디어 일지 #1)
 * @param content 내용, 최대 130자
 * @author seulgae
 * @version 1.0, 아이디어 일지 입력
 * @see "None"
 */
public record IdeaRequest(String title, String content) {}
