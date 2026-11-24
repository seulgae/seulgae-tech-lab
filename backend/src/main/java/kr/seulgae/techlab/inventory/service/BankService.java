package kr.seulgae.techlab.inventory.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.inventory.dto.*;

/**
 * BankService 기능 명세(구현: BankServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see "None"
 */
public interface BankService {
    /** 공통코드 COIN_REASON(V11) */
    String TRANSFER_OUT = "TRANSFER_OUT", TRANSFER_IN = "TRANSFER_IN";
    int TRANSFER_MIN = 1, TRANSFER_MAX = 100, DAILY_TRANSFERS = 10, HISTORY_LIMIT = 30, SEARCH_LIMIT = 10, QUERY_MAX = 20;

    BankViewDTO view(UUID member);

    /** 닉네임으로 받을 사람을 찾는다(1~20자, 나는 빠진다). */
    List<RecipientDTO> search(UUID member, String query);

    /**
     * 송금. 금액이 1~100원이 아니거나 나에게 보내면 400, 받는 사람이 없으면 404,
     * 오늘 10번 보냈으면 429, 잔액이 모자라면 409(아무것도 바꾸지 않음).
     */
    BankViewDTO transfer(UUID from, UUID to, Integer amount);
}
