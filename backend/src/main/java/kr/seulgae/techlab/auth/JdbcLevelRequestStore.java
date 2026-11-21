package kr.seulgae.techlab.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 등급 신청 저장소. 승인은 신청 상태와 회원 등급을 같은 트랜잭션에서 바꾼다(서비스의 @Transactional).
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 */
@Repository
public class JdbcLevelRequestStore implements LevelRequestStore {
    private static final String SELECT = """
        SELECT r.id, r.member_id, m.nickname, r.requested_level, r.reason, r.status, r.created_at
        FROM lab.level_requests r JOIN lab.members m ON m.id = r.member_id""";
    private final JdbcClient jdbc;

    public JdbcLevelRequestStore(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public Optional<LevelRequest> create(UUID memberId, int level, String reason) {
        var id = UUID.randomUUID();
        try {
            jdbc.sql("INSERT INTO lab.level_requests (id, member_id, requested_level, reason) VALUES (:id, :m, :level, :reason)")
                .param("id", id).param("m", memberId).param("level", level).param("reason", reason).update();
        } catch (DuplicateKeyException pending) { return Optional.empty(); }
        return jdbc.sql(SELECT + " WHERE r.id = :id").param("id", id).query((rs, row) -> map(rs)).optional();
    }

    @Override public Optional<LevelRequest> latest(UUID memberId) {
        return jdbc.sql(SELECT + " WHERE r.member_id = :m ORDER BY r.created_at DESC, r.id DESC LIMIT 1").param("m", memberId).query((rs, row) -> map(rs)).optional();
    }

    @Override public List<LevelRequest> pending() {
        return jdbc.sql(SELECT + " WHERE r.status = 'PENDING' ORDER BY r.created_at, r.id LIMIT 100").query((rs, row) -> map(rs)).list();
    }

    @Override public Optional<LevelRequest> decide(UUID requestId, boolean approve, UUID decidedBy) {
        var decided = jdbc.sql("""
            UPDATE lab.level_requests SET status = :status, decided_at = CURRENT_TIMESTAMP, decided_by = :by
            WHERE id = :id AND status = 'PENDING' RETURNING member_id, requested_level
            """).param("status", approve ? "APPROVED" : "REJECTED").param("by", decidedBy).param("id", requestId)
            .query((rs, row) -> new Object[]{rs.getObject(1, UUID.class), rs.getInt(2)}).optional();
        if (decided.isEmpty()) return Optional.empty();
        if (approve) {
            jdbc.sql("UPDATE lab.members SET level = :level WHERE id = :m").param("level", decided.get()[1]).param("m", decided.get()[0]).update();
        }
        return jdbc.sql(SELECT + " WHERE r.id = :id").param("id", requestId).query((rs, row) -> map(rs)).optional();
    }

    @Override public int level(UUID memberId) {
        return jdbc.sql("SELECT level FROM lab.members WHERE id = :m").param("m", memberId).query(Integer.class).optional().orElse(1);
    }

    private static LevelRequest map(ResultSet rs) throws SQLException {
        return new LevelRequest(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getInt(4), rs.getString(5),
            rs.getString(6), rs.getObject(7, OffsetDateTime.class));
    }
}
