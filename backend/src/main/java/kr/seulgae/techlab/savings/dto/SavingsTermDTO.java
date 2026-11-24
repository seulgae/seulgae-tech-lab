package kr.seulgae.techlab.savings.dto;

/**
 * 가입할 수 있는 적금 상품: 기간(일)과 만기 이자율(%).
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
public record SavingsTermDTO(int days, int ratePct) {}
