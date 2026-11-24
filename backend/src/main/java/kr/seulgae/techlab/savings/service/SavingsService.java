package kr.seulgae.techlab.savings.service;

import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.savings.dto.SavingsViewDTO;

/**
 * 은행 적금 명세(구현: SavingsServiceImpl).
 * 기간을 골라 넣으면 만기에 원금과 이자를 받는다. 만기 전에 찾으면(해지) 원금만 돌려받는다.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
public interface SavingsService {
    /** 기간(일) → 만기 이자율(%) */
    Map<Integer, Integer> TERMS = Map.of(1, 3, 3, 10, 7, 25);
    /** 한 번에 넣는 금액, 동시에 들 수 있는 적금 수, 보여 줄 찾은 적금 수 */
    int MIN_AMOUNT = 1, MAX_AMOUNT = 1000, MAX_OPEN = 3, CLOSED_SHOWN = 10;
    /** 공통코드 COIN_REASON */
    String DEPOSIT = "SAVINGS_DEPOSIT", PAYOUT = "SAVINGS_PAYOUT";

    /**
     * 적금 화면 값.
     *
     * @param member 회원 ID
     * @return 동전·상품·적금 목록
     */
    SavingsViewDTO view(UUID member);

    /**
     * 적금에 가입한다(동전을 바로 뺀다).
     *
     * @param member 회원 ID
     * @param amount 원금
     * @param days 기간
     * @return 적금 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 금액·기간이 틀리면 400, 동전 부족·개수 초과 409
     */
    SavingsViewDTO deposit(UUID member, Integer amount, Integer days);

    /**
     * 적금을 찾는다. 만기가 지났으면 원금+이자, 아니면 원금만.
     *
     * @param member 회원 ID
     * @param id 적금 ID
     * @return 적금 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 내 적금이 아니면 404, 이미 찾았으면 409
     */
    SavingsViewDTO withdraw(UUID member, UUID id);
}
