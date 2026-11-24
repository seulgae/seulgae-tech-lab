package kr.seulgae.techlab.savings.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.savings.entity.Savings;
import kr.seulgae.techlab.savings.repository.SavingsRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 적금 저장소(tb_lab_savings).
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see "None"
 */
@Repository
public class JdbcSavingsRepository implements SavingsRepository {
    private static final String COLUMNS = "id, principal, term_days, rate_pct, created_at, matures_at, closed_at, payout";
    private final JdbcClient jdbc;

    public JdbcSavingsRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<Savings> list(UUID member, int closedLimit) {
        String open = "SELECT " + COLUMNS + " FROM lab.tb_lab_savings WHERE member_id = :m AND closed_at IS NULL";
        String closed = "SELECT " + COLUMNS + " FROM lab.tb_lab_savings WHERE member_id = :m AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT :limit";
        return jdbc.sql("(" + open + ") UNION ALL (" + closed + ") ORDER BY created_at DESC")
            .param("m", member).param("limit", closedLimit).query((rs, row) -> map(rs)).list();
    }

    @Override public int openCount(UUID member) {
        return jdbc.sql("SELECT count(*) FROM lab.tb_lab_savings WHERE member_id = :m AND closed_at IS NULL")
            .param("m", member).query(Integer.class).single();
    }

    @Override public Savings create(UUID member, int principal, int termDays, int ratePct, OffsetDateTime createdAt, OffsetDateTime maturesAt) {
        return jdbc.sql("INSERT INTO lab.tb_lab_savings (id, member_id, principal, term_days, rate_pct, created_at, matures_at) "
                + "VALUES (:id, :m, :principal, :days, :rate, :created, :matures) RETURNING " + COLUMNS)
            .param("id", UUID.randomUUID()).param("m", member).param("principal", principal).param("days", termDays)
            .param("rate", ratePct).param("created", createdAt).param("matures", maturesAt).query((rs, row) -> map(rs)).single();
    }

    @Override public Optional<Savings> find(UUID member, UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_savings WHERE id = :id AND member_id = :m")
            .param("id", id).param("m", member).query((rs, row) -> map(rs)).optional();
    }

    @Override public boolean close(UUID member, UUID id, int payout, OffsetDateTime closedAt) {
        return jdbc.sql("UPDATE lab.tb_lab_savings SET closed_at = :at, payout = :payout WHERE id = :id AND member_id = :m AND closed_at IS NULL")
            .param("at", closedAt).param("payout", payout).param("id", id).param("m", member).update() == 1;
    }

    /**
     * 조회 결과 한 행을 적금으로 바꾼다.
     *
     * @param rs 결과 행
     * @return 적금
     * @exception SQLException 열을 읽지 못하면
     */
    private static Savings map(ResultSet rs) throws SQLException {
        int payout = rs.getInt("payout");
        Integer paid = rs.wasNull() ? null : payout;
        return new Savings(rs.getObject("id", UUID.class), rs.getInt("principal"), rs.getInt("term_days"), rs.getInt("rate_pct"),
            rs.getObject("created_at", OffsetDateTime.class), rs.getObject("matures_at", OffsetDateTime.class),
            rs.getObject("closed_at", OffsetDateTime.class), paid);
    }
}
