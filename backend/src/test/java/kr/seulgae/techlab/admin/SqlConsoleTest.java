package kr.seulgae.techlab.admin;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.auth.InMemoryLevelRequestStore;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 쿼리 콘솔: 한 문장만, 결과 200행 제한, 시간 제한 설정, 실패 시 되돌리기, 관리자 확인.
 * JDBC는 작은 가짜(Proxy)로 대신한다(실제 PostgreSQL 실행은 운영에서 확인).
 * @author seulgae
 * @version 1.0, 관리자실 쿼리 콘솔
 * @see "None"
 */
class SqlConsoleTest {
    /** 실행된 SQL과 commit/rollback 기록 */
    private final List<String> log = new ArrayList<>();

    private DataSource fake(int rows, Integer updated, String failOn) {
        ResultSetMetaData meta = proxy(ResultSetMetaData.class, (name, args) -> switch (name) {
            case "getColumnCount" -> 2;
            case "getColumnLabel" -> (int) args[0] == 1 ? "id" : "title";
            default -> null;
        });
        int[] cursor = {0};
        ResultSet resultSet = proxy(ResultSet.class, (name, args) -> switch (name) {
            case "next" -> cursor[0]++ < rows;
            case "getString" -> (int) args[0] == 1 ? String.valueOf(cursor[0]) : (cursor[0] == 1 ? "x".repeat(1500) : null);
            case "getMetaData" -> meta;
            default -> null;
        });
        Statement statement = proxy(Statement.class, (name, args) -> switch (name) {
            case "execute" -> {
                log.add((String) args[0]);
                if (failOn != null && ((String) args[0]).contains(failOn)) throw new SQLException("relation \"nope\" does not exist");
                yield updated == null;
            }
            case "getResultSet" -> resultSet;
            case "getUpdateCount" -> updated;
            default -> null;
        });
        Connection connection = proxy(Connection.class, (name, args) -> switch (name) {
            case "createStatement" -> statement;
            case "getAutoCommit" -> true;
            case "commit", "rollback" -> { log.add(name); yield null; }
            default -> null;
        });
        return proxy(DataSource.class, (name, args) -> name.equals("getConnection") ? connection : null);
    }

    interface Handler { Object call(String name, Object[] args) throws Throwable; }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, Handler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (self, method, args) -> handler.call(method.getName(), args));
    }

    @Test void runsOneStatementWithTimeoutAndCapsRowsAndCells() {
        var result = new SqlConsole(fake(250, null, null)).run("  SELECT id, title FROM lab.guestbook_entries ;  ");
        assertEquals(List.of("SET LOCAL statement_timeout = '5s'", "SELECT id, title FROM lab.guestbook_entries", "commit"), log);
        assertEquals(List.of("id", "title"), result.columns());
        assertEquals(200, result.rows().size(), "최대 200행");
        assertTrue(result.truncated());
        assertEquals(1001, result.rows().get(0).get(1).length(), "칸은 1,000자 + …");
        assertNull(result.rows().get(1).get(1), "NULL은 null");
        assertNull(result.updated());
    }

    @Test void reportsUpdatedRowsAndRollsBackOnError() {
        var result = new SqlConsole(fake(0, 3, null)).run("DELETE FROM lab.guestbook_entries WHERE title = '테스트'");
        assertEquals(3, result.updated());
        assertTrue(result.columns().isEmpty());
        log.clear();
        var error = assertThrows(ResponseStatusException.class, () -> new SqlConsole(fake(0, null, "nope")).run("SELECT * FROM nope"));
        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("does not exist"), "DB 오류 메시지를 그대로 보여 준다");
        assertEquals("rollback", log.get(log.size() - 1));
    }

    @Test void rejectsEmptyMultipleOrHugeStatements() {
        for (String sql : new String[]{null, "  ", ";", "SELECT 1; SELECT 2", "DELETE FROM a; DROP TABLE b;", "x".repeat(10_001)}) {
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> SqlConsole.statement(sql)).getStatusCode().value(), String.valueOf(sql).length() > 40 ? "long" : String.valueOf(sql));
        }
        assertEquals("SELECT 1", SqlConsole.statement("SELECT 1;;"));
    }

    @Test void onlyLevelThreeMembersAreAdmins() {
        var store = new InMemoryLevelRequestStore();
        var access = new AdminAccess((AuthService) null, store);
        var id = UUID.randomUUID();
        assertFalse(access.isAdmin(id), "일반 사용자(1)는 관리자가 아니다");
        store.setLevel(id, 2);
        assertFalse(access.isAdmin(id), "운영자(2)도 관리자가 아니다");
        store.setLevel(id, 3);
        assertTrue(access.isAdmin(id));
        assertFalse(access.isAdmin(null));
    }
}
