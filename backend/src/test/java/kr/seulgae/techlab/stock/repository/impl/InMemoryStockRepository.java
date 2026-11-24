package kr.seulgae.techlab.stock.repository.impl;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import kr.seulgae.techlab.stock.entity.Holding;
import kr.seulgae.techlab.stock.entity.PricePoint;
import kr.seulgae.techlab.stock.entity.Stock;
import kr.seulgae.techlab.stock.repository.StockRepository;

/**
 * DB 없는 로컬 실행·테스트용 주식 저장소(V20 시드와 같은 종목).
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
public class InMemoryStockRepository implements StockRepository {
    private final Map<String, Stock> stocks = new LinkedHashMap<>();
    private final Map<String, List<PricePoint>> prices = new LinkedHashMap<>();
    private final Map<String, Holding> holdings = new ConcurrentHashMap<>();

    public InMemoryStockRepository(OffsetDateTime seededAt) {
        for (var stock : List.of(
            new Stock("SGLB", "슬개랩", "이 연구소. 꾸준하지만 느리다", 100, 3, seededAt),
            new Stock("BUGX", "버그잡스", "버그 잡는 로봇 스타트업", 40, 12, seededAt),
            new Stock("COFE", "커피머신산업", "연구원들의 연료 공급원", 60, 5, seededAt),
            new Stock("FISH", "강가수산", "낚시꾼이 잡은 물고기를 사들인다", 25, 8, seededAt),
            new Stock("GPUS", "지피유반도체", "모두가 원하는 칩, 출렁임이 크다", 150, 15, seededAt),
            new Stock("ARCD", "오락실홀딩스", "사다리·홀짝의 그 회사. 도박 같은 주식", 15, 25, seededAt))) {
            stocks.put(stock.code(), stock);
            prices.put(stock.code(), new ArrayList<>(List.of(new PricePoint(stock.code(), seededAt, stock.price()))));
        }
    }

    public InMemoryStockRepository() { this(OffsetDateTime.now()); }

    @Override public synchronized List<Stock> stocks() { return List.copyOf(stocks.values()); }

    @Override public synchronized Map<String, List<Integer>> recentPrices(int perStock) {
        Map<String, List<Integer>> result = new LinkedHashMap<>();
        prices.forEach((code, points) -> result.put(code, points.subList(Math.max(0, points.size() - perStock), points.size()).stream().map(PricePoint::price).toList()));
        return result;
    }

    @Override public synchronized boolean move(String code, OffsetDateTime expectedUpdatedAt, List<PricePoint> points) {
        var stock = stocks.get(code);
        if (stock == null || !stock.updatedAt().isEqual(expectedUpdatedAt)) return false;
        var last = points.get(points.size() - 1);
        stocks.put(code, new Stock(code, stock.name(), stock.summary(), last.price(), stock.volatilityPct(), last.at()));
        prices.get(code).addAll(points);
        return true;
    }

    @Override public synchronized void prune(OffsetDateTime before) {
        prices.values().forEach(points -> points.removeIf(point -> point.at().isBefore(before)));
    }

    @Override public List<Holding> holdings(UUID member) {
        return stocks.keySet().stream().map(code -> holdings.get(member + code)).filter(java.util.Objects::nonNull).toList();
    }

    @Override public Optional<Holding> holding(UUID member, String code) { return Optional.ofNullable(holdings.get(member + code)); }

    @Override public void saveHolding(UUID member, String code, int quantity, int totalCost) {
        if (quantity == 0) holdings.remove(member + code);
        else holdings.put(member + code, new Holding(code, quantity, totalCost));
    }
}
