package kr.seulgae.techlab.lobby.guestbook.repository.impl;

import kr.seulgae.techlab.lobby.guestbook.entity.*;
import kr.seulgae.techlab.lobby.guestbook.repository.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 방명록 저장소. 작성자 닉네임은 회원 테이블에서 함께 읽는다.
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
@Repository
public class JdbcGuestbookRepository implements GuestbookRepository {
    private final JdbcClient jdbc;

    public JdbcGuestbookRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<Guestbook> latest(String category, int limit) {
        return jdbc.sql("""
            SELECT g.id, g.category, g.title, g.content, m.nickname, g.created_at
            FROM lab.tb_lab_guestbook g LEFT JOIN lab.tb_lab_member m ON m.id = g.author_id
            WHERE g.category = :category ORDER BY g.created_at DESC, g.id DESC LIMIT :limit""")
            .param("category", category).param("limit", limit).query((rs, row) -> map(rs)).list();
    }

    @Override public Guestbook insert(String category, String title, String content, UUID authorId) {
        return jdbc.sql("""
            WITH created AS (
                INSERT INTO lab.tb_lab_guestbook (id, category, title, content, author_id)
                VALUES (:id, :category, :title, :content, :author)
                RETURNING id, category, title, content, author_id, created_at)
            SELECT c.id, c.category, c.title, c.content, m.nickname, c.created_at
            FROM created c LEFT JOIN lab.tb_lab_member m ON m.id = c.author_id""")
            .param("id", UUID.randomUUID()).param("category", category).param("title", title)
            .param("content", content).param("author", authorId).query((rs, row) -> map(rs)).single();
    }

    private static Guestbook map(ResultSet rs) throws SQLException {
        return new Guestbook(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
            rs.getObject(6, OffsetDateTime.class));
    }
}
