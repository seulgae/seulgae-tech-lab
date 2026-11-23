package kr.seulgae.techlab.phone;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 할 일 저장소. 모든 쿼리를 member_id로 묶어 남의 할 일은 보이지도 바뀌지도 않는다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(캘린더)
 * @see "None"
 */
@Repository
public class JdbcTodoStore implements TodoStore {
    private static final String COLUMNS = "id, due_date, title, done, created_at";
    private final JdbcClient jdbc;

    public JdbcTodoStore(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<Todo> between(UUID member, LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_todo WHERE member_id = :m AND due_date BETWEEN :from AND :to ORDER BY due_date, created_at, id")
            .param("m", member).param("from", from).param("to", to).query((rs, row) -> map(rs)).list();
    }

    @Override public int count(UUID member) {
        return jdbc.sql("SELECT count(*) FROM lab.tb_lab_todo WHERE member_id = :m").param("m", member).query(Integer.class).single();
    }

    @Override public Todo insert(UUID member, LocalDate date, String title) {
        return jdbc.sql("INSERT INTO lab.tb_lab_todo (id, member_id, due_date, title) VALUES (:id, :m, :date, :title) RETURNING " + COLUMNS)
            .param("id", UUID.randomUUID()).param("m", member).param("date", date).param("title", title).query((rs, row) -> map(rs)).single();
    }

    @Override public Optional<Todo> setDone(UUID member, UUID id, boolean done) {
        return jdbc.sql("UPDATE lab.tb_lab_todo SET done = :done WHERE id = :id AND member_id = :m RETURNING " + COLUMNS)
            .param("done", done).param("id", id).param("m", member).query((rs, row) -> map(rs)).optional();
    }

    @Override public int delete(UUID member, UUID id) {
        return jdbc.sql("DELETE FROM lab.tb_lab_todo WHERE id = :id AND member_id = :m").param("id", id).param("m", member).update();
    }

    private static Todo map(ResultSet rs) throws SQLException {
        return new Todo(rs.getObject("id", UUID.class), rs.getObject("due_date", LocalDate.class), rs.getString("title"), rs.getBoolean("done"),
            rs.getObject("created_at", OffsetDateTime.class));
    }
}
