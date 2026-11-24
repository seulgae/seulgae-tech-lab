package kr.seulgae.techlab.stock.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Random;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.stock.repository.impl.InMemoryStockRepository;
import org.junit.jupiter.api.Test;

/**
 * 주식: 10분마다 시세 변동(밀린 만큼 따라잡기), 매수·매도와 평균 단가, 수량·잔액 제한.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
class StockServiceTest {
    private final Instant start = Instant.parse("2026-11-24T03:00:00Z");
    private final Instant[] now = { start };
    private final Clock clock = new Clock() {
        @Override public ZoneId getZone() { return ZoneId.of("Asia/Seoul"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now[0]; }
    };
    private final InMemoryInventoryRepository inventory = new InMemoryInventoryRepository();
    private final StockServiceImpl service = new StockServiceImpl(new InMemoryStockRepository(OffsetDateTime.ofInstant(start, ZoneId.of("Asia/Seoul"))), inventory, new Random(7), clock);
    private final UUID me = UUID.randomUUID();

    @Test
    void pricesMoveOncePerTickAndCatchUp() {
        var first = service.view(me);
        assertThat(first.stocks()).hasSize(6);
        assertThat(first.stocks().get(0).history()).hasSize(1);
        now[0] = start.plus(Duration.ofMinutes(9));
        assertThat(service.view(me).stocks().get(0).history()).hasSize(1);
        now[0] = start.plus(Duration.ofMinutes(35));
        var later = service.view(me);
        assertThat(later.stocks().get(0).history()).hasSize(4);
        assertThat(later.nextTickSeconds()).isEqualTo(300);
    }

    @Test
    void buyAndSellKeepAverageCost() {
        inventory.changeCoins(me, 1000, "TEST");
        var bought = service.buy(me, "SGLB", 4);
        assertThat(bought.coins()).isEqualTo(600);
        assertThat(bought.holdings()).singleElement().satisfies(held -> { assertThat(held.quantity()).isEqualTo(4); assertThat(held.totalCost()).isEqualTo(400); });
        var sold = service.sell(me, "SGLB", 1);
        assertThat(sold.coins()).isEqualTo(700);
        assertThat(sold.holdings().get(0).totalCost()).isEqualTo(300);
        assertThat(service.sell(me, "SGLB", 3).holdings()).isEmpty();
        assertThat(sold.tradesLeftToday()).isEqualTo(28);
    }

    @Test
    void rejectsBadTrades() {
        inventory.changeCoins(me, 50, "TEST");
        assertThatThrownBy(() -> service.buy(me, "SGLB", 0)).hasMessageContaining("400");
        assertThatThrownBy(() -> service.buy(me, "NOPE", 1)).hasMessageContaining("404");
        assertThatThrownBy(() -> service.buy(me, "SGLB", 1)).hasMessageContaining("409");
        assertThatThrownBy(() -> service.sell(me, "FISH", 1)).hasMessageContaining("409");
        assertThat(service.view(me).coins()).isEqualTo(50);
    }

    @Test
    void nextPriceStaysWithinVolatilityAndAboveZero() {
        var random = new Random(1);
        for (int i = 0; i < 1000; i++) {
            int next = StockServiceImpl.nextPrice(100, 10, random);
            assertThat(next).isBetween(90, 110);
        }
        for (int i = 0; i < 100; i++) assertThat(StockServiceImpl.nextPrice(1, 25, random)).isBetween(1, 2);
    }
}
