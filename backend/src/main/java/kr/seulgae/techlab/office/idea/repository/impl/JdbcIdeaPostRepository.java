package kr.seulgae.techlab.office.idea.repository.impl;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.office.idea.entity.IdeaPost;
import kr.seulgae.techlab.office.idea.repository.IdeaPostRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 아이디어 기획 게시판 저장소(tb_lab_idea_post, 닉네임은 tb_lab_member).
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see "None"
 */
@Repository
public class JdbcIdeaPostRepository implements IdeaPostRepository {
    private final JdbcClient jdbc;

    public JdbcIdeaPostRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<IdeaPost> recent(int limit) {
        return jdbc.sql("""
            SELECT p.id, p.title, p.content, m.nickname, p.created_at FROM lab.tb_lab_idea_post p
            LEFT JOIN lab.tb_lab_member m ON m.id = p.author_id ORDER BY p.created_at DESC, p.id DESC LIMIT :limit""")
            .param("limit", limit)
            .query((rs, row) -> new IdeaPost(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4), rs.getObject(5, OffsetDateTime.class))).list();
    }

    @Override public IdeaPost create(UUID author, String title, String content) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO lab.tb_lab_idea_post (id, author_id, title, content) VALUES (:id, :author, :title, :content)")
            .param("id", id).param("author", author).param("title", title).param("content", content).update();
        return recent(1).stream().filter(post -> post.id().equals(id)).findFirst()
            .orElseGet(() -> new IdeaPost(id, title, content, null, OffsetDateTime.now()));
    }
}
