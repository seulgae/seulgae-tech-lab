package kr.seulgae.techlab.admin.controller;

import kr.seulgae.techlab.admin.dto.*;
import kr.seulgae.techlab.admin.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 관리자실 쿼리 콘솔 API. 모든 요청에서 로그인 세션이 관리자 회원인지 서버가 확인한다(문을 막는 것만으로는 보안이 아니다).
 * 실행한 SQL은 감사용으로 서버 로그에 남긴다.
 *
 * @author seulgae
 * @version 1.0, 관리자실 쿼리 콘솔
 * @see "None"
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final Logger LOG = LoggerFactory.getLogger(AdminController.class);

    private final AdminAccess access;
    private final SqlConsoleService console;

    public AdminController(AdminAccess access, SqlConsoleService console) { this.access = access; this.console = console; }

    @GetMapping("/tables")
    public List<TableInfoDTO> tables(HttpServletRequest request) {
        access.require(request);
        return console.tables();
    }

    /** SQL 한 문장 실행. 실패하면 400과 DB 오류 메시지 */
    @PostMapping("/sql")
    public ResponseEntity<?> run(@RequestBody(required = false) SqlRequestDTO body, HttpServletRequest request) {
        var admin = access.require(request);
        String sql = body == null ? null : body.sql();
        String logged = sql == null ? "" : sql.strip().replaceAll("\\s+", " ");
        if (logged.length() > 500) logged = logged.substring(0, 500) + "…";
        try {
            var result = console.run(sql);
            LOG.warn("[admin-sql] member={} ms={} rows={} updated={} sql={}", admin, result.millis(), result.rows().size(), result.updated(), logged);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException exception) {
            LOG.warn("[admin-sql] member={} failed={} sql={}", admin, exception.getReason(), logged);
            return ResponseEntity.status(exception.getStatusCode()).body(Map.of("error", String.valueOf(exception.getReason())));
        }
    }
}
