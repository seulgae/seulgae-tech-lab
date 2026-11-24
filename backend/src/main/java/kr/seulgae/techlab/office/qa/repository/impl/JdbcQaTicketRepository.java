package kr.seulgae.techlab.office.qa.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.office.qa.entity.QaTicket;
import kr.seulgae.techlab.office.qa.repository.QaTicketRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL QA 티켓 저장소(tb_lab_qa_ticket, 상태 이름은 tb_lab_common_code, 닉네임은 tb_lab_member).
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see None
 */
@Repository
public class JdbcQaTicketRepository implements QaTicketRepository {
    private static final String SELECT = """
        SELECT t.id, t.title, t.content, t.status, c.name AS status_name, m.nickname, t.created_at, t.updated_at
        FROM lab.tb_lab_qa_ticket t
        JOIN lab.tb_lab_common_code c ON c.code_group = t.status_group AND c.code = t.status
        LEFT JOIN lab.tb_lab_member m ON m.id = t.author_id""";
    private final JdbcClient jdbc;

    public JdbcQaTicketRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<QaTicket> recent(int limit) {
        return jdbc.sql(SELECT + " ORDER BY t.created_at DESC, t.id DESC LIMIT :limit").param("limit", limit).query((rs, row) -> map(rs)).list();
    }

    @Override public Optional<QaTicket> find(UUID id) {
        return jdbc.sql(SELECT + " WHERE t.id = :id").param("id", id).query((rs, row) -> map(rs)).optional();
    }

    @Override public UUID create(UUID author, String title, String content) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO lab.tb_lab_qa_ticket (id, author_id, title, content) VALUES (:id, :author, :title, :content)")
            .param("id", id).param("author", author).param("title", title).param("content", content).update();
        return id;
    }

    @Override public boolean move(UUID id, String from, String to) {
        return jdbc.sql("UPDATE lab.tb_lab_qa_ticket SET status = :to, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND status = :from")
            .param("to", to).param("id", id).param("from", from).update() == 1;
    }

    /**
     * 조회 결과 한 행을 티켓으로 바꾼다.
     *
     * @param rs 결과 행
     * @return 티켓
     * @exception SQLException 열을 읽지 못하면
     */
    private static QaTicket map(ResultSet rs) throws SQLException {
        return new QaTicket(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("content"), rs.getString("status"),
            rs.getString("status_name"), rs.getString("nickname"), rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }
}
