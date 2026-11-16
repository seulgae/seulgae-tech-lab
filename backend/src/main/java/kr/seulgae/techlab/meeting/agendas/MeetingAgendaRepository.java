package kr.seulgae.techlab.meeting.agendas;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * JDBC로 회의 안건을 조회·저장한다.
 *
 * @author seulgae
 * @version 1.0, lab.meeting_agendas 접근
 * @see "None"
 */
@Repository
public class MeetingAgendaRepository {
    private static final String COLUMNS = "id, title, content, created_at, updated_at";
    private final JdbcClient jdbc;
    public MeetingAgendaRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    /** 최신순 목록. 다음 페이지 여부 확인을 위해 호출자가 limit+1을 요청한다. */
    public List<MeetingAgenda> list(int limit, int offset) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.meeting_agendas ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset")
            .param("limit", limit).param("offset", offset).query((rs, row) -> map(rs)).list();
    }

    public MeetingAgenda create(String title, String content, String editTokenHash) {
        return jdbc.sql("INSERT INTO lab.meeting_agendas (id, title, content, edit_token_hash) VALUES (:id, :title, :content, :hash) RETURNING " + COLUMNS)
            .param("id", UUID.randomUUID()).param("title", title).param("content", content).param("hash", editTokenHash)
            .query((rs, row) -> map(rs)).single();
    }

    /** @return 수정 키 해시, 행이 없으면 빈 Optional */
    public Optional<String> editTokenHash(UUID id) {
        return jdbc.sql("SELECT edit_token_hash FROM lab.meeting_agendas WHERE id = :id").param("id", id).query(String.class).optional();
    }

    public MeetingAgenda update(UUID id, String title, String content) {
        return jdbc.sql("UPDATE lab.meeting_agendas SET title = :title, content = :content, updated_at = CURRENT_TIMESTAMP WHERE id = :id RETURNING " + COLUMNS)
            .param("id", id).param("title", title).param("content", content).query((rs, row) -> map(rs)).single();
    }

    public int delete(UUID id) {
        return jdbc.sql("DELETE FROM lab.meeting_agendas WHERE id = :id").param("id", id).update();
    }

    private static MeetingAgenda map(ResultSet rs) throws SQLException {
        return new MeetingAgenda(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("content"),
            rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }
}
