package kr.seulgae.techlab.stock.service;

import java.time.Duration;
import java.util.UUID;
import kr.seulgae.techlab.stock.dto.StockViewDTO;

/**
 * 주식 앱 명세(구현: StockServiceImpl).
 * 가상 종목의 시세는 10분마다 종목별 최대 등락폭 안에서 무작위로 움직인다. 누구에게나 같은 시세가 보인다.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see "None"
 */
public interface StockService {
    /** 시세가 한 번 움직이는 간격 */
    Duration TICK = Duration.ofMinutes(10);
    /** 오래 아무도 안 봐도 한 번에 따라잡는 최대 변동 수(6시간) */
    int MAX_CATCH_UP = 36;
    /** 차트 점 수, 한 번에 사고파는 수량, 하루 거래 횟수, 종목당 최대 보유 수량 */
    int HISTORY_POINTS = 36, MAX_QUANTITY = 100, DAILY_TRADES = 30, MAX_HOLDING = 10000;
    /** 공통코드 COIN_REASON */
    String BUY = "STOCK_BUY", SELL = "STOCK_SELL";

    /**
     * 시세를 따라잡은 뒤 화면 값을 돌려준다.
     *
     * @param member 회원 ID
     * @return 주식 화면 값
     */
    StockViewDTO view(UUID member);

    /**
     * 현재가로 산다.
     *
     * @param member 회원 ID
     * @param code 종목 코드
     * @param quantity 수량
     * @return 주식 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 수량이 틀리면 400, 없는 종목 404, 동전 부족·보유 한도 409, 거래 횟수 429
     */
    StockViewDTO buy(UUID member, String code, Integer quantity);

    /**
     * 현재가로 판다.
     *
     * @param member 회원 ID
     * @param code 종목 코드
     * @param quantity 수량
     * @return 주식 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 수량이 틀리면 400, 없는 종목 404, 가진 것보다 많으면 409, 거래 횟수 429
     */
    StockViewDTO sell(UUID member, String code, Integer quantity);
}
