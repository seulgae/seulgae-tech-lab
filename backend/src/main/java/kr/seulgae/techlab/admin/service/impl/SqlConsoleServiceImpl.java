package kr.seulgae.techlab.admin.service.impl;

import kr.seulgae.techlab.admin.dto.*;
import kr.seulgae.techlab.admin.service.*;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 관리자실 쿼리 콘솔: 운영 DB에 SQL 한 문장을 실행한다(앱 DB 계정 권한 그대로).
 * 안전장치: 한 번에 한 문장, 5초 시간 제한, 결과 최대 200행·칸당 1,000자, 실패하면 되돌리기(rollback).
 *
 * @author seulgae
 * @version 1.0, 관리자실 쿼리 콘솔
 * @see "None"
 */
@Service
public class SqlConsoleServiceImpl implements SqlConsoleService {


    private final DataSource dataSource;

    public SqlConsoleServiceImpl(DataSource dataSource) { this.dataSource = dataSource; }

    /** 공백과 끝 세미콜론을 정리한다. 비었거나, 너무 길거나, 여러 문장이면 400 */
    static String statement(String sql) {
        if (sql == null) throw bad("SQL을 입력해 주세요.");
        String trimmed = sql.strip();
        while (trimmed.endsWith(";")) trimmed = trimmed.substring(0, trimmed.length() - 1).strip();
        if (trimmed.isEmpty()) throw bad("SQL을 입력해 주세요.");
        if (trimmed.length() > MAX_SQL) throw bad("SQL은 10,000자까지 실행할 수 있어요.");
        if (trimmed.contains(";")) throw bad("한 번에 한 문장만 실행할 수 있어요(세미콜론 ; 은 끝에만).");
        return trimmed;
    }

    public SqlResultDTO run(String sql) {
        String statement = statement(sql);
        long started = System.nanoTime();
        try (Connection connection = dataSource.getConnection()) {
            boolean autoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                try (var timeout = connection.createStatement()) { timeout.execute("SET LOCAL statement_timeout = '" + TIMEOUT + "'"); }
                SqlResultDTO result;
                try (var query = connection.createStatement()) {
                    query.setMaxRows(MAX_ROWS + 1);
                    if (query.execute(statement)) {
                        try (ResultSet rs = query.getResultSet()) { result = read(rs, started); }
                    } else {
                        result = new SqlResultDTO(List.of(), List.of(), false, query.getUpdateCount(), elapsed(started));
                    }
                }
                connection.commit();
                return result;
            } catch (SQLException exception) {
                connection.rollback();
                throw bad(exception.getMessage());
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "DB 연결에 실패했어요.");
        }
    }

    /** 앱 DB 계정이 볼 수 있는 모든 테이블·뷰(시스템 스키마 제외) */
    public List<TableInfoDTO> tables() {
        String sql = """
            SELECT table_schema, table_name, table_type FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name""";
        try (Connection connection = dataSource.getConnection(); var query = connection.createStatement(); ResultSet rs = query.executeQuery(sql)) {
            List<TableInfoDTO> tables = new ArrayList<>();
            while (rs.next()) tables.add(new TableInfoDTO(rs.getString(1), rs.getString(2), "VIEW".equals(rs.getString(3)) ? "VIEW" : "TABLE"));
            return tables;
        } catch (SQLException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "DB 연결에 실패했어요.");
        }
    }

    private static SqlResultDTO read(ResultSet rs, long started) throws SQLException {
        var meta = rs.getMetaData();
        int count = meta.getColumnCount();
        List<String> columns = new ArrayList<>(count);
        for (int i = 1; i <= count; i++) columns.add(meta.getColumnLabel(i));
        List<List<String>> rows = new ArrayList<>();
        boolean truncated = false;
        while (rs.next()) {
            if (rows.size() == MAX_ROWS) { truncated = true; break; }
            List<String> row = new ArrayList<>(count);
            for (int i = 1; i <= count; i++) {
                String value = rs.getString(i);
                row.add(value != null && value.length() > MAX_CELL ? value.substring(0, MAX_CELL) + "…" : value);
            }
            rows.add(row);
        }
        return new SqlResultDTO(columns, rows, truncated, null, elapsed(started));
    }

    private static long elapsed(long started) { return (System.nanoTime() - started) / 1_000_000; }

    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
