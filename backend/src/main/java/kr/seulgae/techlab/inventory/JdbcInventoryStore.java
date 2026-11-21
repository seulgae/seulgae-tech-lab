package kr.seulgae.techlab.inventory;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 인벤토리 저장소. 잔액 변경은 "잔액 + 변동 ≥ 0"을 조건으로 한 번의 UPDATE로 처리해 동시 요청에도 음수가 되지 않는다.
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
@Repository
public class JdbcInventoryStore implements InventoryStore {
    private static final String COLUMNS = "id, kind, name, size_cm, room_id, x, y, created_at";
    private final JdbcClient jdbc;

    public JdbcInventoryStore(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public int coins(UUID member) {
        return jdbc.sql("SELECT coins FROM lab.inventories WHERE member_id = :m").param("m", member).query(Integer.class).optional().orElse(0);
    }

    @Override public Vitals vitals(UUID member) {
        return jdbc.sql("SELECT hp, hp_max, fatigue, fatigue_max FROM lab.inventories WHERE member_id = :m").param("m", member)
            .query((rs, row) -> vitals(rs)).optional().orElse(new Vitals(50, 50, 50, 50));
    }

    @Override public Optional<Vitals> changeVitals(UUID member, int hp, int fatigue) {
        jdbc.sql("INSERT INTO lab.inventories (member_id, coins) VALUES (:m, 0) ON CONFLICT (member_id) DO NOTHING").param("m", member).update();
        return jdbc.sql("""
            UPDATE lab.inventories SET hp = LEAST(hp_max, hp + :hp), fatigue = LEAST(fatigue_max, fatigue + :fatigue), updated_at = CURRENT_TIMESTAMP
            WHERE member_id = :m AND hp + :hp >= 0 AND fatigue + :fatigue >= 0 RETURNING hp, hp_max, fatigue, fatigue_max
            """).param("m", member).param("hp", hp).param("fatigue", fatigue).query((rs, row) -> vitals(rs)).optional();
    }

    private static Vitals vitals(ResultSet rs) throws SQLException {
        return new Vitals(rs.getInt("hp"), rs.getInt("hp_max"), rs.getInt("fatigue"), rs.getInt("fatigue_max"));
    }

    @Override public Optional<Integer> changeCoins(UUID member, int amount, String reason) {
        jdbc.sql("INSERT INTO lab.inventories (member_id, coins) VALUES (:m, 0) ON CONFLICT (member_id) DO NOTHING").param("m", member).update();
        var balance = jdbc.sql("""
            UPDATE lab.inventories SET coins = coins + :amount, updated_at = CURRENT_TIMESTAMP
            WHERE member_id = :m AND coins + :amount >= 0 RETURNING coins
            """).param("m", member).param("amount", amount).query(Integer.class).optional();
        balance.ifPresent(ignored -> jdbc.sql("INSERT INTO lab.coin_events (id, member_id, amount, reason) VALUES (:id, :m, :amount, :reason)")
            .param("id", UUID.randomUUID()).param("m", member).param("amount", amount).param("reason", reason).update());
        return balance;
    }

    @Override public int countToday(UUID member, String reason) {
        return jdbc.sql("""
            SELECT count(*) FROM lab.coin_events WHERE member_id = :m AND reason = :reason
            AND created_at >= (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')
            """).param("m", member).param("reason", reason).query(Integer.class).single();
    }

    @Override public List<Item> owned(UUID member) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.items WHERE owner_id = :m ORDER BY created_at DESC, id").param("m", member)
            .query((rs, row) -> map(rs)).list();
    }

    @Override public Item add(UUID member, String kind, String name, Integer sizeCm) {
        return jdbc.sql("INSERT INTO lab.items (id, owner_id, kind, name, size_cm) VALUES (:id, :m, :kind, :name, :size) RETURNING " + COLUMNS)
            .param("id", UUID.randomUUID()).param("m", member).param("kind", kind).param("name", name).param("size", sizeCm)
            .query((rs, row) -> map(rs)).single();
    }

    @Override public Optional<Item> drop(UUID member, UUID itemId, String roomId, double x, double y) {
        return jdbc.sql("UPDATE lab.items SET owner_id = NULL, room_id = :room, x = :x, y = :y WHERE id = :id AND owner_id = :m RETURNING " + COLUMNS)
            .param("room", roomId).param("x", x).param("y", y).param("id", itemId).param("m", member).query((rs, row) -> map(rs)).optional();
    }

    @Override public int remove(UUID member, UUID itemId) {
        return jdbc.sql("DELETE FROM lab.items WHERE id = :id AND owner_id = :m").param("id", itemId).param("m", member).update();
    }

    @Override public int swap(UUID a, UUID itemA, UUID b, UUID itemB) {
        return jdbc.sql("""
            UPDATE lab.items SET owner_id = CASE WHEN id = :itemA THEN :b ELSE :a END
            WHERE (id = :itemA AND owner_id = :a) OR (id = :itemB AND owner_id = :b)
            """).param("a", a).param("b", b).param("itemA", itemA).param("itemB", itemB).update();
    }

    @Override public List<Item> ground(String roomId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.items WHERE owner_id IS NULL AND room_id = :room ORDER BY created_at, id").param("room", roomId)
            .query((rs, row) -> map(rs)).list();
    }

    @Override public Optional<Item> pick(UUID member, UUID itemId, String roomId) {
        return jdbc.sql("UPDATE lab.items SET owner_id = :m, room_id = NULL, x = NULL, y = NULL WHERE id = :id AND owner_id IS NULL AND room_id = :room RETURNING " + COLUMNS)
            .param("m", member).param("id", itemId).param("room", roomId).query((rs, row) -> map(rs)).optional();
    }

    private static Item map(ResultSet rs) throws SQLException {
        int size = rs.getInt("size_cm");
        Integer sizeCm = rs.wasNull() ? null : size;
        double x = rs.getDouble("x");
        Double px = rs.wasNull() ? null : x;
        double y = rs.getDouble("y");
        Double py = rs.wasNull() ? null : y;
        return new Item(rs.getObject("id", UUID.class), rs.getString("kind"), rs.getString("name"), sizeCm, rs.getString("room_id"), px, py,
            rs.getObject("created_at", OffsetDateTime.class));
    }
}
