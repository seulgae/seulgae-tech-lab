package kr.seulgae.techlab.inventory.repository.impl;

import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.entity.*;
import kr.seulgae.techlab.inventory.repository.*;
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
 * @version 1.1, 구매 행 잠금으로 동시 중복 차감 방지
 * @see "None"
 */
@Repository
public class JdbcInventoryRepository implements InventoryRepository {
    private static final String COLUMNS = "id, kind, name, size_cm, room_id, x, y, created_at";
    private final JdbcClient jdbc;

    public JdbcInventoryRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public int coins(UUID member) {
        return jdbc.sql("SELECT coins FROM lab.tb_lab_member_inventory WHERE member_id = :m").param("m", member).query(Integer.class).optional().orElse(0);
    }

    @Override public Vitals vitals(UUID member) {
        return jdbc.sql("SELECT hp, hp_max, fatigue, fatigue_max FROM lab.tb_lab_member_inventory WHERE member_id = :m").param("m", member)
            .query((rs, row) -> vitals(rs)).optional().orElse(new Vitals(50, 50, 50, 50));
    }

    /** 구매 전 회원 행을 잠가 동시에 가득 찬 음료를 결제하지 않도록 한다.
     * @param member 구매 회원
     * @return 잠금 후 최신 회복 상태
     */
    @Override public Vitals lockVitals(UUID member) {
        jdbc.sql("INSERT INTO lab.tb_lab_member_inventory (member_id, coins) VALUES (:m, 0) ON CONFLICT (member_id) DO NOTHING").param("m", member).update();
        return jdbc.sql("SELECT hp, hp_max, fatigue, fatigue_max FROM lab.tb_lab_member_inventory WHERE member_id = :m FOR UPDATE")
            .param("m", member).query((rs, row) -> vitals(rs)).single();
    }

    @Override public Optional<Vitals> changeVitals(UUID member, int hp, int fatigue) {
        jdbc.sql("INSERT INTO lab.tb_lab_member_inventory (member_id, coins) VALUES (:m, 0) ON CONFLICT (member_id) DO NOTHING").param("m", member).update();
        return jdbc.sql("""
            UPDATE lab.tb_lab_member_inventory SET hp = LEAST(hp_max, hp + :hp), fatigue = LEAST(fatigue_max, fatigue + :fatigue), updated_at = CURRENT_TIMESTAMP
            WHERE member_id = :m AND hp + :hp >= 0 AND fatigue + :fatigue >= 0 RETURNING hp, hp_max, fatigue, fatigue_max
            """).param("m", member).param("hp", hp).param("fatigue", fatigue).query((rs, row) -> vitals(rs)).optional();
    }

    private static Vitals vitals(ResultSet rs) throws SQLException {
        return new Vitals(rs.getInt("hp"), rs.getInt("hp_max"), rs.getInt("fatigue"), rs.getInt("fatigue_max"));
    }

    @Override public Optional<Integer> changeCoins(UUID member, int amount, String reason, UUID counterpart) {
        jdbc.sql("INSERT INTO lab.tb_lab_member_inventory (member_id, coins) VALUES (:m, 0) ON CONFLICT (member_id) DO NOTHING").param("m", member).update();
        var balance = jdbc.sql("""
            UPDATE lab.tb_lab_member_inventory SET coins = coins + :amount, updated_at = CURRENT_TIMESTAMP
            WHERE member_id = :m AND coins + :amount >= 0 RETURNING coins
            """).param("m", member).param("amount", amount).query(Integer.class).optional();
        balance.ifPresent(ignored -> jdbc.sql("INSERT INTO lab.tb_lab_coin_history (id, member_id, amount, reason, counterpart_id) VALUES (:id, :m, :amount, :reason, :other)")
            .param("id", UUID.randomUUID()).param("m", member).param("amount", amount).param("reason", reason).param("other", counterpart).update());
        return balance;
    }

    @Override public List<CoinHistory> history(UUID member, int limit) {
        return jdbc.sql("""
            SELECT e.id, e.amount, e.reason, c.name, o.nickname, e.created_at
            FROM lab.tb_lab_coin_history e
            JOIN lab.tb_lab_common_code c ON c.code_group = e.reason_group AND c.code = e.reason
            LEFT JOIN lab.tb_lab_member o ON o.id = e.counterpart_id
            WHERE e.member_id = :m ORDER BY e.created_at DESC, e.id DESC LIMIT :limit""")
            .param("m", member).param("limit", limit)
            .query((rs, row) -> new CoinHistory(rs.getObject(1, UUID.class), rs.getInt(2), rs.getString(3), rs.getString(4), rs.getString(5),
                rs.getObject(6, OffsetDateTime.class))).list();
    }

    @Override public List<RecipientDTO> recipients(String query, UUID exclude, int limit) {
        String like = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.sql("""
            SELECT id, nickname FROM lab.tb_lab_member WHERE id <> :me AND nickname ILIKE :q ESCAPE '\\'
            ORDER BY last_login_at DESC NULLS LAST, nickname LIMIT :limit""")
            .param("me", exclude).param("q", like).param("limit", limit)
            .query((rs, row) -> new RecipientDTO(rs.getObject(1, UUID.class), rs.getString(2))).list();
    }

    @Override public Optional<String> nickname(UUID member) {
        return jdbc.sql("SELECT nickname FROM lab.tb_lab_member WHERE id = :m").param("m", member).query(String.class).optional();
    }

    @Override public int countToday(UUID member, String reason) {
        return jdbc.sql("""
            SELECT count(*) FROM lab.tb_lab_coin_history WHERE member_id = :m AND reason = :reason
            AND created_at >= (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')
            """).param("m", member).param("reason", reason).query(Integer.class).single();
    }

    @Override public List<Item> owned(UUID member) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_item WHERE owner_id = :m ORDER BY created_at DESC, id").param("m", member)
            .query((rs, row) -> map(rs)).list();
    }

    @Override public Item add(UUID member, String kind, String name, Integer sizeCm) {
        return jdbc.sql("INSERT INTO lab.tb_lab_item (id, owner_id, kind, name, size_cm) VALUES (:id, :m, :kind, :name, :size) RETURNING " + COLUMNS)
            .param("id", UUID.randomUUID()).param("m", member).param("kind", kind).param("name", name).param("size", sizeCm)
            .query((rs, row) -> map(rs)).single();
    }

    @Override public Optional<Item> drop(UUID member, UUID itemId, String roomId, double x, double y) {
        return jdbc.sql("UPDATE lab.tb_lab_item SET owner_id = NULL, room_id = :room, x = :x, y = :y WHERE id = :id AND owner_id = :m RETURNING " + COLUMNS)
            .param("room", roomId).param("x", x).param("y", y).param("id", itemId).param("m", member).query((rs, row) -> map(rs)).optional();
    }

    @Override public int remove(UUID member, UUID itemId) {
        return jdbc.sql("DELETE FROM lab.tb_lab_item WHERE id = :id AND owner_id = :m").param("id", itemId).param("m", member).update();
    }

    @Override public int swap(UUID a, UUID itemA, UUID b, UUID itemB) {
        return jdbc.sql("""
            UPDATE lab.tb_lab_item SET owner_id = CASE WHEN id = :itemA THEN :b ELSE :a END
            WHERE (id = :itemA AND owner_id = :a) OR (id = :itemB AND owner_id = :b)
            """).param("a", a).param("b", b).param("itemA", itemA).param("itemB", itemB).update();
    }

    @Override public List<Item> ground(String roomId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_item WHERE owner_id IS NULL AND room_id = :room ORDER BY created_at, id").param("room", roomId)
            .query((rs, row) -> map(rs)).list();
    }

    @Override public Optional<Item> pick(UUID member, UUID itemId, String roomId) {
        return jdbc.sql("UPDATE lab.tb_lab_item SET owner_id = :m, room_id = NULL, x = NULL, y = NULL WHERE id = :id AND owner_id IS NULL AND room_id = :room RETURNING " + COLUMNS)
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

    /* 소지품 행이 없으면 먼저 만든다(회원의 첫 게임 기록). */
    private void ensureRow(UUID member) {
        jdbc.sql("INSERT INTO lab.tb_lab_member_inventory (member_id, coins) VALUES (:m, 0) ON CONFLICT (member_id) DO NOTHING").param("m", member).update();
    }

    @Override public int workCount(UUID member) {
        return jdbc.sql("SELECT work_count FROM lab.tb_lab_member_inventory WHERE member_id = :m").param("m", member).query(Integer.class).optional().orElse(0);
    }

    @Override public int addWork(UUID member) {
        ensureRow(member);
        return jdbc.sql("UPDATE lab.tb_lab_member_inventory SET work_count = work_count + 1, updated_at = CURRENT_TIMESTAMP WHERE member_id = :m RETURNING work_count")
            .param("m", member).query(Integer.class).single();
    }

    @Override public void raiseVitals(UUID member, int max) {
        ensureRow(member);
        jdbc.sql("UPDATE lab.tb_lab_member_inventory SET hp_max = :max, hp = :max, fatigue_max = :max, fatigue = :max, updated_at = CURRENT_TIMESTAMP WHERE member_id = :m")
            .param("max", max).param("m", member).update();
    }

    @Override public Optional<OffsetDateTime> lastSalaryAt(UUID member) {
        return jdbc.sql("SELECT last_salary_at FROM lab.tb_lab_member_inventory WHERE member_id = :m").param("m", member)
            .query((rs, row) -> Optional.ofNullable(rs.getObject(1, OffsetDateTime.class))).optional().flatMap(value -> value);
    }

    @Override public boolean claimSalary(UUID member, OffsetDateTime now, OffsetDateTime cutoff) {
        ensureRow(member);
        return jdbc.sql("UPDATE lab.tb_lab_member_inventory SET last_salary_at = :now WHERE member_id = :m AND (last_salary_at IS NULL OR last_salary_at <= :cutoff)")
            .param("now", now).param("m", member).param("cutoff", cutoff).update() == 1;
    }

    @Override public Optional<Vitals> rest(UUID member, int hp, int fatigue, OffsetDateTime now, OffsetDateTime cutoff) {
        ensureRow(member);
        return jdbc.sql("""
            UPDATE lab.tb_lab_member_inventory SET hp = LEAST(hp_max, hp + :hp), fatigue = LEAST(fatigue_max, fatigue + :fatigue),
                last_rest_at = :now, updated_at = CURRENT_TIMESTAMP
            WHERE member_id = :m AND (last_rest_at IS NULL OR last_rest_at <= :cutoff) RETURNING hp, hp_max, fatigue, fatigue_max
            """).param("m", member).param("hp", hp).param("fatigue", fatigue).param("now", now).param("cutoff", cutoff)
            .query((rs, row) -> vitals(rs)).optional();
    }
}
