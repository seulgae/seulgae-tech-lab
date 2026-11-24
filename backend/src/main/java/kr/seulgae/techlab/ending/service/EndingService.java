package kr.seulgae.techlab.ending.service;

import java.util.UUID;
import kr.seulgae.techlab.rule.service.GameRules;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 서버의 직급과 지갑 잔액으로 엔딩 자격을 판정하고 회원에 환생 여부를 기록한다.
 *
 * @author seulgae
 * @version 1.0, 엔딩 자격 및 환생 기록
 * @see GameRules
 */
@Service
public class EndingService {
    private static final int REQUIRED_BALANCE = 100_000;
    private final JdbcClient jdbc;
    private final GameRules rules;

    public EndingService(JdbcClient jdbc, GameRules rules) {
        this.jdbc = jdbc;
        this.rules = rules;
    }

    /**
     * 대화 시작 자격과 이전 환생 기록을 조회한다.
     *
     * @param member 로그인한 회원 ID
     * @return 엔딩 자격과 환생 기록
     */
    public EndingStatus status(UUID member) {
        return jdbc.sql("""
            SELECT COALESCE(i.coins, 0), COALESCE(i.work_count, 0), m.reborn
            FROM lab.tb_lab_member m
            LEFT JOIN lab.tb_lab_member_inventory i ON i.member_id = m.id
            WHERE m.id = :member
            """).param("member", member)
            .query((row, index) -> new EndingStatus(eligible(row.getInt(1), row.getInt(2)), row.getBoolean(3)))
            .optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    /**
     * 마지막 대화에서 인벤토리 행을 잠근 상태로 자격을 다시 확인한 뒤 기록한다.
     *
     * @param member 로그인한 회원 ID
     * @throws ResponseStatusException 연구소장 또는 잔액 조건을 충족하지 않을 때
     */
    @Transactional
    public void complete(UUID member) {
        var allowed = jdbc.sql("""
            SELECT coins, work_count
            FROM lab.tb_lab_member_inventory
            WHERE member_id = :member FOR UPDATE
            """).param("member", member).query((row, index) -> eligible(row.getInt(1), row.getInt(2))).optional();
        if (!allowed.orElse(false)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ending requirements not met");
        }
        jdbc.sql("UPDATE lab.tb_lab_member SET reborn = true WHERE id = :member AND NOT reborn")
            .param("member", member).update();
    }

    private boolean eligible(int balance, int workCount) {
        return balance >= REQUIRED_BALANCE && "DIRECTOR".equals(rules.rankOf(workCount).code());
    }

    /**
     * 화면에 필요한 엔딩 자격과 기존 환생 여부다.
     *
     * @author seulgae
     * @version 1.0, 엔딩 자격 응답
     * @see "None"
     */
    public record EndingStatus(boolean eligible, boolean reborn) {}
}
