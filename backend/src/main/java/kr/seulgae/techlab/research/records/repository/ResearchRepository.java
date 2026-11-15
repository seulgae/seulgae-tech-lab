package kr.seulgae.techlab.research.records.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.domain.ResearchSummary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * JDBC로 공통 연구 기록을 조회·저장하고 결과 행을 모델에 매핑한다.
 *
 * @author seulgae
 * @version 1.0, 연구 기록 저장소와 DB 접근 책임 문서화
 * @see "None"
 */
@Repository
public class ResearchRepository {
    private final JdbcClient jdbc;

    /**
     * SQL 실행을 위한 JDBC 클라이언트를 주입받는다.
     *
     * @param jdbc JDBC 클라이언트
     */
    public ResearchRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    /**
     * 작성 시각과 식별자 내림차순으로 연구 기록 요약을 조회한다.
     *
     * @param limit 조회할 최대 행 수
     * @param offset 건너뛸 행 수
     * @return 정렬된 연구 기록 요약 목록
     * @throws org.springframework.dao.DataAccessException DB 조회가 실패한 경우
     */
    public List<ResearchSummary> list(int limit, int offset) {
        return jdbc.sql("""
            SELECT id, title, summary, created_at FROM lab.research_records
            ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset
            """).param("limit", limit).param("offset", offset)
            .query((rs, row) -> new ResearchSummary(rs.getObject("id", UUID.class), rs.getString("title"),
                rs.getString("summary"), rs.getObject("created_at", OffsetDateTime.class))).list();
    }

    /**
     * 기록 식별자로 상세 행을 조회한다.
     *
     * @param id 기록 식별자
     * @return 조회된 기록 또는 빈 Optional
     * @throws org.springframework.dao.DataAccessException DB 조회가 실패한 경우
     */
    public Optional<ResearchRecord> find(UUID id) {
        return jdbc.sql("SELECT id, title, summary, content, created_at FROM lab.research_records WHERE id = :id")
            .param("id", id).query((rs, row) -> map(rs)).optional();
    }

    /**
     * 새 UUID로 기록을 저장하고 DB가 부여한 작성 시각을 함께 반환한다.
     *
     * @param title 공백 정리를 마친 제목
     * @param summary 공백 정리를 마친 요약
     * @param content 공백 정리를 마친 본문
     * @return 저장된 연구 기록
     * @throws org.springframework.dao.DataAccessException DB 저장이 실패한 경우
     */
    public ResearchRecord create(String title, String summary, String content) {
        return jdbc.sql("""
            INSERT INTO lab.research_records (id, title, summary, content)
            VALUES (:id, :title, :summary, :content)
            RETURNING id, title, summary, content, created_at
            """).param("id", UUID.randomUUID()).param("title", title)
            .param("summary", summary).param("content", content)
            .query((rs, row) -> map(rs)).single();
    }

    /**
     * 현재 결과 행을 연구 기록 상세 모델로 변환한다.
     *
     * @param rs 현재 행을 가리키는 JDBC 조회 결과
     * @return 연구 기록 상세 모델
     * @throws SQLException 컬럼 값을 읽지 못한 경우
     */
    private static ResearchRecord map(ResultSet rs) throws SQLException {
        return new ResearchRecord(rs.getObject("id", UUID.class), rs.getString("title"),
            rs.getString("summary"), rs.getString("content"), rs.getObject("created_at", OffsetDateTime.class));
    }
}
