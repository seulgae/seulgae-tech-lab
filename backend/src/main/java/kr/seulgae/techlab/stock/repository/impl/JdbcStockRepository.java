package kr.seulgae.techlab.stock.repository.impl;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.stock.entity.Holding;
import kr.seulgae.techlab.stock.entity.PricePoint;
import kr.seulgae.techlab.stock.entity.Stock;
import kr.seulgae.techlab.stock.repository.StockRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 주식 저장소(tb_lab_stock, tb_lab_stock_price, tb_lab_member_stock).
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
@Repository
public class JdbcStockRepository implements StockRepository {
    private final JdbcClient jdbc;

    public JdbcStockRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<Stock> stocks() {
        return jdbc.sql("SELECT code, name, summary, price, volatility_pct, updated_at FROM lab.tb_lab_stock ORDER BY sort_order, code")
            .query((rs, row) -> new Stock(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4), rs.getInt(5), rs.getObject(6, OffsetDateTime.class))).list();
    }

    @Override public Map<String, List<Integer>> recentPrices(int perStock) {
        Map<String, List<Integer>> result = new LinkedHashMap<>();
        /* 종목마다 최근 N점을 고른 뒤 오래된 것부터 담는다. */
        jdbc.sql("""
            SELECT stock_code, price FROM (
              SELECT stock_code, price, recorded_at, row_number() OVER (PARTITION BY stock_code ORDER BY recorded_at DESC) AS n
              FROM lab.tb_lab_stock_price) recent
            WHERE n <= :limit ORDER BY stock_code, recorded_at""")
            .param("limit", perStock)
            .query((rs, row) -> { result.computeIfAbsent(rs.getString(1), key -> new ArrayList<>()).add(rs.getInt(2)); return null; }).list();
        return result;
    }

    @Override public boolean move(String code, OffsetDateTime expectedUpdatedAt, List<PricePoint> points) {
        PricePoint last = points.get(points.size() - 1);
        int updated = jdbc.sql("UPDATE lab.tb_lab_stock SET price = :price, updated_at = :at WHERE code = :code AND updated_at = :expected")
            .param("price", last.price()).param("at", last.at()).param("code", code).param("expected", expectedUpdatedAt).update();
        if (updated != 1) return false;
        for (PricePoint point : points) {
            jdbc.sql("INSERT INTO lab.tb_lab_stock_price (stock_code, recorded_at, price) VALUES (:code, :at, :price) ON CONFLICT DO NOTHING")
                .param("code", code).param("at", point.at()).param("price", point.price()).update();
        }
        return true;
    }

    @Override public void prune(OffsetDateTime before) {
        jdbc.sql("DELETE FROM lab.tb_lab_stock_price WHERE recorded_at < :before").param("before", before).update();
    }

    @Override public List<Holding> holdings(UUID member) {
        return jdbc.sql("SELECT h.stock_code, h.quantity, h.total_cost FROM lab.tb_lab_member_stock h JOIN lab.tb_lab_stock s ON s.code = h.stock_code WHERE h.member_id = :m ORDER BY s.sort_order")
            .param("m", member).query((rs, row) -> new Holding(rs.getString(1), rs.getInt(2), rs.getInt(3))).list();
    }

    @Override public Optional<Holding> holding(UUID member, String code) {
        /* 같은 회원이 동시에 사고팔 때 수량이 꼬이지 않게 행을 잠근다. */
        return jdbc.sql("SELECT stock_code, quantity, total_cost FROM lab.tb_lab_member_stock WHERE member_id = :m AND stock_code = :code FOR UPDATE")
            .param("m", member).param("code", code).query((rs, row) -> new Holding(rs.getString(1), rs.getInt(2), rs.getInt(3))).optional();
    }

    @Override public void saveHolding(UUID member, String code, int quantity, int totalCost) {
        if (quantity == 0) {
            jdbc.sql("DELETE FROM lab.tb_lab_member_stock WHERE member_id = :m AND stock_code = :code").param("m", member).param("code", code).update();
            return;
        }
        jdbc.sql("""
            INSERT INTO lab.tb_lab_member_stock (member_id, stock_code, quantity, total_cost, updated_at)
            VALUES (:m, :code, :quantity, :cost, CURRENT_TIMESTAMP)
            ON CONFLICT (member_id, stock_code) DO UPDATE SET quantity = EXCLUDED.quantity, total_cost = EXCLUDED.total_cost, updated_at = CURRENT_TIMESTAMP""")
            .param("m", member).param("code", code).param("quantity", quantity).param("cost", totalCost).update();
    }
}
