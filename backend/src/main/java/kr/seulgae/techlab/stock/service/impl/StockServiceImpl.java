package kr.seulgae.techlab.stock.service.impl;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.service.VitalsGate;
import kr.seulgae.techlab.stock.dto.StockDTO;
import kr.seulgae.techlab.stock.dto.StockViewDTO;
import kr.seulgae.techlab.stock.entity.Holding;
import kr.seulgae.techlab.stock.entity.PricePoint;
import kr.seulgae.techlab.stock.entity.Stock;
import kr.seulgae.techlab.stock.repository.StockRepository;
import kr.seulgae.techlab.stock.service.StockService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 주식 앱 구현.
 * 시세는 스케줄러 없이 "누군가 볼 때 밀린 만큼 따라잡는" 방식으로 움직인다. 같은 시각에 여럿이 보면
 * 마지막 변동 시각이 맞는 한 요청만 옮기고(낙관적 잠금), 나머지는 옮겨진 값을 다시 읽는다.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
@Service
public class StockServiceImpl implements StockService {
    private final StockRepository stocks;
    private final InventoryRepository inventory;
    private final Random random;
    private final Clock clock;
    /** 거래 한 번에 드는 HP·기력(STOCK_TRADE) */
    private VitalsGate gate;

    @Autowired
    public StockServiceImpl(StockRepository stocks, InventoryRepository inventory, VitalsGate gate) { this(stocks, inventory); this.gate = gate; }

    public StockServiceImpl(StockRepository stocks, InventoryRepository inventory) { this(stocks, inventory, new SecureRandom(), Clock.systemDefaultZone()); }

    public StockServiceImpl(StockRepository stocks, InventoryRepository inventory, Random random, Clock clock) {
        this.stocks = stocks; this.inventory = inventory; this.random = random; this.clock = clock; this.gate = VitalsGate.defaults(inventory);
    }

    @Override
    @Transactional
    public StockViewDTO view(UUID member) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Stock> current = refresh(now);
        Map<String, List<Integer>> history = stocks.recentPrices(HISTORY_POINTS);
        List<StockDTO> list = current.stream().map(stock -> {
            List<Integer> points = history.getOrDefault(stock.code(), List.of(stock.price()));
            int previous = points.size() >= 2 ? points.get(points.size() - 2) : stock.price();
            double change = Math.round((stock.price() - previous) * 1000.0 / previous) / 10.0;
            return new StockDTO(stock.code(), stock.name(), stock.summary(), stock.price(), change, points);
        }).toList();
        long next = current.stream().mapToLong(stock -> Duration.between(now, stock.updatedAt().plus(TICK)).toSeconds()).min().orElse(0);
        int tradesLeft = Math.max(0, DAILY_TRADES - inventory.countToday(member, BUY) - inventory.countToday(member, SELL));
        return new StockViewDTO(inventory.coins(member), list, stocks.holdings(member), tradesLeft, Math.max(0, next));
    }

    @Override
    @Transactional
    public StockViewDTO buy(UUID member, String code, Integer quantity) {
        Stock stock = tradable(member, code, quantity);
        Holding held = stocks.holding(member, stock.code()).orElse(new Holding(stock.code(), 0, 0));
        if (held.quantity() + quantity > MAX_HOLDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "Holding limit");
        gate.ensureFit(member, ActionCost.STOCK_TRADE);
        int cost = stock.price() * quantity;
        /* 동전부터 뺀다: 모자라면 주식을 늘리지 않는다. */
        inventory.changeCoins(member, -cost, BUY).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        stocks.saveHolding(member, stock.code(), held.quantity() + quantity, held.totalCost() + cost);
        gate.spend(member, ActionCost.STOCK_TRADE);
        return view(member);
    }

    @Override
    @Transactional
    public StockViewDTO sell(UUID member, String code, Integer quantity) {
        Stock stock = tradable(member, code, quantity);
        Holding held = stocks.holding(member, stock.code()).orElse(new Holding(stock.code(), 0, 0));
        if (held.quantity() < quantity) throw new ResponseStatusException(HttpStatus.CONFLICT, "Not enough shares");
        gate.ensureFit(member, ActionCost.STOCK_TRADE);
        /* 판 만큼 산 금액도 비율대로 줄여 남은 주식의 평균 단가를 유지한다. */
        int remaining = held.quantity() - quantity;
        int remainingCost = remaining == 0 ? 0 : (int) ((long) held.totalCost() * remaining / held.quantity());
        stocks.saveHolding(member, stock.code(), remaining, remainingCost);
        inventory.changeCoins(member, stock.price() * quantity, SELL).orElseThrow();
        gate.spend(member, ActionCost.STOCK_TRADE);
        return view(member);
    }

    /**
     * 거래 공통 확인: 수량, 거래 횟수, 종목(시세를 따라잡은 현재가).
     *
     * @param member 회원 ID
     * @param code 종목 코드
     * @param quantity 수량
     * @return 현재 종목
     */
    private Stock tradable(UUID member, String code, Integer quantity) {
        if (quantity == null || quantity < 1 || quantity > MAX_QUANTITY) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantity must be 1-" + MAX_QUANTITY);
        if (inventory.countToday(member, BUY) + inventory.countToday(member, SELL) >= DAILY_TRADES) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily trade limit");
        return refresh(OffsetDateTime.now(clock)).stream().filter(stock -> stock.code().equals(code)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown stock"));
    }

    /**
     * 밀린 시세 변동을 따라잡고 최신 종목 목록을 돌려준다.
     *
     * @param now 지금
     * @return 종목
     */
    List<Stock> refresh(OffsetDateTime now) {
        boolean moved = false;
        for (Stock stock : stocks.stocks()) {
            long steps = Math.min(MAX_CATCH_UP, Duration.between(stock.updatedAt(), now).toMillis() / TICK.toMillis());
            if (steps <= 0) continue;
            /* 너무 오래 밀렸으면 최근 MAX_CATCH_UP번만 그린다(마지막 시각은 지금 쪽으로 맞춘다). */
            OffsetDateTime start = Duration.between(stock.updatedAt(), now).toMillis() / TICK.toMillis() > MAX_CATCH_UP
                ? now.minus(TICK.multipliedBy(MAX_CATCH_UP)) : stock.updatedAt();
            List<PricePoint> points = new ArrayList<>();
            int price = stock.price();
            for (int step = 1; step <= steps; step++) {
                price = nextPrice(price, stock.volatilityPct(), random);
                points.add(new PricePoint(stock.code(), start.plus(TICK.multipliedBy(step)), price));
            }
            moved |= stocks.move(stock.code(), stock.updatedAt(), points);
        }
        if (moved) stocks.prune(now.minusDays(2));
        return stocks.stocks();
    }

    /**
     * 다음 시세: 지금 가격에서 ±최대 등락폭(%) 안에서 고르게 고른다. 1원 아래로는 내려가지 않고, 1원에서도 오를 수 있다.
     *
     * @param price 지금 가격
     * @param volatilityPct 최대 등락폭(%)
     * @param random 난수
     * @return 다음 가격(1~100000)
     */
    public static int nextPrice(int price, int volatilityPct, Random random) {
        double change = (random.nextDouble() * 2 - 1) * volatilityPct / 100.0;
        long next = Math.round(price * (1 + change));
        if (next == price && change > 0.005) next = price + 1;
        return (int) Math.max(1, Math.min(100_000, next));
    }
}
