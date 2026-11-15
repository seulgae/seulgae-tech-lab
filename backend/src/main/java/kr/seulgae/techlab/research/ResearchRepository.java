package kr.seulgae.techlab.research;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ResearchRepository {
    private final JdbcClient jdbc;

    public ResearchRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public record ResearchSummary(UUID id, String title, String summary, OffsetDateTime createdAt) {}

    public List<ResearchSummary> list(int limit, int offset) {
        return jdbc.sql("""
            SELECT id, title, summary, created_at FROM lab.research_records
            ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset
            """).param("limit", limit).param("offset", offset)
            .query((rs, row) -> new ResearchSummary(rs.getObject("id", UUID.class), rs.getString("title"),
                rs.getString("summary"), rs.getObject("created_at", OffsetDateTime.class))).list();
    }

    public Optional<ResearchRecord> find(UUID id) {
        return jdbc.sql("SELECT id, title, summary, content, created_at FROM lab.research_records WHERE id = :id")
            .param("id", id).query((rs, row) -> map(rs)).optional();
    }

    public ResearchRecord create(CreateResearchRequest request) {
        return jdbc.sql("""
            INSERT INTO lab.research_records (id, title, summary, content)
            VALUES (:id, :title, :summary, :content)
            RETURNING id, title, summary, content, created_at
            """).param("id", UUID.randomUUID()).param("title", request.title().strip())
            .param("summary", request.summary().strip()).param("content", request.content().strip())
            .query((rs, row) -> map(rs)).single();
    }

    private static ResearchRecord map(ResultSet rs) throws SQLException {
        return new ResearchRecord(rs.getObject("id", UUID.class), rs.getString("title"),
            rs.getString("summary"), rs.getString("content"), rs.getObject("created_at", OffsetDateTime.class));
    }
}
