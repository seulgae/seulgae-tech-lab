package kr.seulgae.techlab.dorm.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.dorm.entity.Furniture;
import kr.seulgae.techlab.dorm.entity.MemberFurniture;
import kr.seulgae.techlab.dorm.repository.DormRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 개인 기숙사 가구 저장소(tb_lab_furniture, tb_lab_member_furniture).
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
@Repository
public class JdbcDormRepository implements DormRepository {
    private static final String COLUMNS = "id, furniture_code, placed, x, y";
    private final JdbcClient jdbc;

    public JdbcDormRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<Furniture> catalog() {
        return jdbc.sql("SELECT code, name, price, width, height, blocking FROM lab.tb_lab_furniture ORDER BY sort_order, code")
            .query((rs, row) -> new Furniture(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getInt(5), rs.getBoolean(6))).list();
    }

    @Override public List<MemberFurniture> owned(UUID member) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lab.tb_lab_member_furniture WHERE member_id = :m ORDER BY created_at, id")
            .param("m", member).query((rs, row) -> map(rs)).list();
    }

    @Override public MemberFurniture add(UUID member, String code) {
        return jdbc.sql("INSERT INTO lab.tb_lab_member_furniture (id, member_id, furniture_code) VALUES (:id, :m, :code) RETURNING " + COLUMNS)
            .param("id", UUID.randomUUID()).param("m", member).param("code", code).query((rs, row) -> map(rs)).single();
    }

    @Override public Optional<MemberFurniture> place(UUID member, UUID id, int x, int y) {
        return jdbc.sql("""
            UPDATE lab.tb_lab_member_furniture SET placed = true, x = :x, y = :y, placed_at = CURRENT_TIMESTAMP
            WHERE id = :id AND member_id = :m RETURNING\s""" + COLUMNS)
            .param("x", x).param("y", y).param("id", id).param("m", member).query((rs, row) -> map(rs)).optional();
    }

    @Override public Optional<MemberFurniture> store(UUID member, UUID id) {
        return jdbc.sql("UPDATE lab.tb_lab_member_furniture SET placed = false, x = NULL, y = NULL WHERE id = :id AND member_id = :m RETURNING " + COLUMNS)
            .param("id", id).param("m", member).query((rs, row) -> map(rs)).optional();
    }

    /**
     * 조회 결과 한 행을 회원 가구로 바꾼다.
     *
     * @param rs 결과 행
     * @return 회원 가구
     * @exception SQLException 열을 읽지 못하면
     */
    private static MemberFurniture map(ResultSet rs) throws SQLException {
        int x = rs.getInt("x");
        Integer px = rs.wasNull() ? null : x;
        int y = rs.getInt("y");
        Integer py = rs.wasNull() ? null : y;
        return new MemberFurniture(rs.getObject("id", UUID.class), rs.getString("furniture_code"), rs.getBoolean("placed"), px, py);
    }
}
