package kr.seulgae.techlab.office.desk.dto;

/**
 * 자바 연습 요청(problemId·format)과 결과(output·correct·rewarded·error)를 함께 쓴다.
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see None
 */
public record JavaAnswerDTO(String problemId, String format, String output, Boolean correct, Boolean rewarded, String error) {}
