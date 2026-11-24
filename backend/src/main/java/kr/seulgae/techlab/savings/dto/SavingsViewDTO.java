package kr.seulgae.techlab.savings.dto;

import java.util.List;
import kr.seulgae.techlab.savings.entity.Savings;

/**
 * 적금 화면 값: 내 동전, 상품, 진행 중·최근 찾은 적금, 한 번에 넣을 수 있는 금액과 동시에 들 수 있는 개수.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see "None"
 */
public record SavingsViewDTO(int coins, List<SavingsTermDTO> terms, List<Savings> savings, int maxAmount, int maxOpen) {}
