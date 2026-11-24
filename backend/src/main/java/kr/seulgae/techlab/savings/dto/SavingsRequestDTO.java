package kr.seulgae.techlab.savings.dto;

/**
 * 적금 요청: 가입은 amount·days, 찾기는 id.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
public record SavingsRequestDTO(Integer amount, Integer days, String id) {}
