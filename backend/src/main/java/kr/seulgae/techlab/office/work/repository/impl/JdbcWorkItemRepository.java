package kr.seulgae.techlab.office.work.repository.impl;

import kr.seulgae.techlab.office.work.entity.*;
import kr.seulgae.techlab.office.work.repository.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 업무 게시판 저장소(V5 lab.tb_lab_common_code, lab.tb_lab_work_item).
 *
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
@Repository
public class JdbcWorkItemRepository implements WorkItemRepository {
    private static final String COLUMNS = "id, parent_id, category, status, title, content, guide, created_at";
    private final JdbcClient jdbc;

    public JdbcWorkItemRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<CommonCode> codes(String group) {
        return jdbc.sql("SELECT code_group, code, name, sort_order FROM lab.tb_lab_common_code WHERE code_group = :group ORDER BY sort_order, code")
            .param("group", group).query((rs, row) -> new CommonCode(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4))).list();
    }

    @Override public List<WorkItem> byCategory(String category, int limit) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_work_item WHERE category = :category ORDER BY created_at DESC, id DESC LIMIT :limit")
            .param("category", category).param("limit", limit).query((rs, row) -> map(rs)).list();
    }

    @Override public List<WorkItem> tickets(Collection<String> statuses, int limit) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_work_item WHERE parent_id IS NULL AND status IN (:statuses) ORDER BY created_at DESC, id DESC LIMIT :limit")
            .param("statuses", List.copyOf(statuses)).param("limit", limit).query((rs, row) -> map(rs)).list();
    }

    @Override public Optional<WorkItem> find(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_work_item WHERE id = :id").param("id", id).query((rs, row) -> map(rs)).optional();
    }

    @Override public List<WorkItem> children(UUID ticketId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_work_item WHERE parent_id = :id ORDER BY created_at, id")
            .param("id", ticketId).query((rs, row) -> map(rs)).list();
    }

    @Override public WorkItem insert(UUID parentId, String category, String status, String title, String content, String guide, UUID authorId) {
        return jdbc.sql("""
            INSERT INTO lab.tb_lab_work_item (id, parent_id, category, status, title, content, guide, author_id)
            VALUES (:id, :parent, :category, :status, :title, :content, :guide, :author)
            RETURNING """ + " " + COLUMNS)
            .param("id", UUID.randomUUID()).param("parent", parentId).param("category", category).param("status", status)
            .param("title", title).param("content", content).param("guide", guide).param("author", authorId)
            .query((rs, row) -> map(rs)).single();
    }

    @Override public void updateStatus(UUID ticketId, String status) {
        jdbc.sql("UPDATE lab.tb_lab_work_item SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND parent_id IS NULL")
            .param("status", status).param("id", ticketId).update();
    }

    private static WorkItem map(ResultSet rs) throws SQLException {
        return new WorkItem(rs.getObject("id", UUID.class), rs.getObject("parent_id", UUID.class), rs.getString("category"), rs.getString("status"),
            rs.getString("title"), rs.getString("content"), rs.getString("guide"), rs.getObject("created_at", OffsetDateTime.class));
    }
}
