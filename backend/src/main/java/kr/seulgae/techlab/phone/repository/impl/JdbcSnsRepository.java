package kr.seulgae.techlab.phone.repository.impl;

import kr.seulgae.techlab.phone.entity.*;
import kr.seulgae.techlab.phone.repository.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL SNS 저장소. 작성자 닉네임은 회원 테이블에서 함께 읽는다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(SNS)
 * @see "None"
 */
@Repository
public class JdbcSnsRepository implements SnsRepository {
    private final JdbcClient jdbc;

    public JdbcSnsRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<SnsPost> latest(int limit) {
        return jdbc.sql("""
            SELECT p.id, p.author_id, m.nickname, p.content, p.created_at
            FROM lab.tb_lab_sns_post p JOIN lab.tb_lab_member m ON m.id = p.author_id
            ORDER BY p.created_at DESC, p.id DESC LIMIT :limit""")
            .param("limit", limit).query((rs, row) -> map(rs)).list();
    }

    @Override public SnsPost insert(UUID author, String content) {
        return jdbc.sql("""
            WITH created AS (
                INSERT INTO lab.tb_lab_sns_post (id, author_id, content) VALUES (:id, :author, :content)
                RETURNING id, author_id, content, created_at)
            SELECT c.id, c.author_id, m.nickname, c.content, c.created_at
            FROM created c JOIN lab.tb_lab_member m ON m.id = c.author_id""")
            .param("id", UUID.randomUUID()).param("author", author).param("content", content).query((rs, row) -> map(rs)).single();
    }

    @Override public int countToday(UUID author) {
        return jdbc.sql("""
            SELECT count(*) FROM lab.tb_lab_sns_post WHERE author_id = :author
            AND created_at >= (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')""")
            .param("author", author).query(Integer.class).single();
    }

    @Override public Optional<UUID> author(UUID id) {
        return jdbc.sql("SELECT author_id FROM lab.tb_lab_sns_post WHERE id = :id").param("id", id).query(UUID.class).optional();
    }

    @Override public int delete(UUID id) {
        return jdbc.sql("DELETE FROM lab.tb_lab_sns_post WHERE id = :id").param("id", id).update();
    }

    private static SnsPost map(ResultSet rs) throws SQLException {
        return new SnsPost(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getString(4), rs.getObject(5, OffsetDateTime.class));
    }
}
