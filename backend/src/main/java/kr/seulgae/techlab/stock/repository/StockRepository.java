package kr.seulgae.techlab.stock.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.stock.entity.Holding;
import kr.seulgae.techlab.stock.entity.PricePoint;
import kr.seulgae.techlab.stock.entity.Stock;

/**
 * 주식 저장소 명세(구현: JdbcStockRepository, 테스트: InMemoryStockRepository).
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
public interface StockRepository {
    /**
     * 종목 목록(표시 순서).
     *
     * @return 종목
     */
    List<Stock> stocks();

    /**
     * 종목마다 최근 시세 기록(오래된 것부터).
     *
     * @param perStock 종목마다 몇 점까지
     * @return 종목 코드 → 시세
     */
    Map<String, List<Integer>> recentPrices(int perStock);

    /**
     * 시세를 옮긴다. 다른 요청이 먼저 옮겼으면(마지막 변동 시각이 다르면) 아무것도 바꾸지 않는다.
     *
     * @param code 종목 코드
     * @param expectedUpdatedAt 읽을 때의 마지막 변동 시각
     * @param points 새 시세 기록(마지막 점이 현재가)
     * @return 이번에 옮겼으면 true
     */
    boolean move(String code, OffsetDateTime expectedUpdatedAt, List<PricePoint> points);

    /**
     * 이 시각보다 오래된 시세 기록을 지운다.
     *
     * @param before 기준 시각
     */
    void prune(OffsetDateTime before);

    /**
     * 내 보유 주식.
     *
     * @param member 회원 ID
     * @return 보유 주식
     */
    List<Holding> holdings(UUID member);

    /**
     * 내 보유 주식 한 종목.
     *
     * @param member 회원 ID
     * @param code 종목 코드
     * @return 보유(없으면 빈 값)
     */
    Optional<Holding> holding(UUID member, String code);

    /**
     * 보유 수량·산 금액을 저장한다. 수량이 0이면 행을 지운다.
     *
     * @param member 회원 ID
     * @param code 종목 코드
     * @param quantity 수량
     * @param totalCost 산 금액 합계
     */
    void saveHolding(UUID member, String code, int quantity, int totalCost);
}
