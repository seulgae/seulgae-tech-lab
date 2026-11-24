package kr.seulgae.techlab.ending.service;

import java.util.UUID;
import kr.seulgae.techlab.rule.service.GameRules;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * CI PostgreSQL에서 엔딩 조건과 V25 회원 컬럼에 저장되는 환생 기록을 검증한다.
 *
 * @author seulgae
 * @version 1.0, 환생 자격 경계값과 중복 완료 검증
 * @see EndingService
 */
@EnabledIfEnvironmentVariable(named = "RECRUITMENT_TEST_DB", matches = "true")
class EndingDatabaseTest {
    /** 진입과 재검증에서 직급·잔액을 모두 요구하고, 100,000원에서 잔액 차감 없이 기록한다. */
    @Test
    void requiresDirectorAndThresholdWithoutSpendingCoins() {
        var ds = new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:5432/research_ci?currentSchema=lab", "test_app", "ci-app-only");
        var jdbc = JdbcClient.create(ds);
        var ending = new EndingService(jdbc, GameRules.defaults());
        var tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        UUID member = UUID.randomUUID();
        jdbc.sql("INSERT INTO lab.tb_lab_member (id, kakao_id, nickname) VALUES (:m, :k, '엔딩검증')")
            .param("m", member).param("k", -Math.abs(member.getMostSignificantBits())).update();
        try {
            assertEquals(new EndingService.EndingStatus(false, false), ending.status(member));
            jdbc.sql("INSERT INTO lab.tb_lab_member_inventory (member_id, coins, work_count) VALUES (:m, 100000, 99)")
                .param("m", member).update();
            assertEquals(new EndingService.EndingStatus(false, false), ending.status(member));
            assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> tx.executeWithoutResult(status -> ending.complete(member))).getStatusCode());

            jdbc.sql("UPDATE lab.tb_lab_member_inventory SET work_count = 100, coins = 99999 WHERE member_id = :m")
                .param("m", member).update();
            assertEquals(new EndingService.EndingStatus(false, false), ending.status(member));
            assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> tx.executeWithoutResult(status -> ending.complete(member))).getStatusCode());

            jdbc.sql("UPDATE lab.tb_lab_member_inventory SET coins = 100000 WHERE member_id = :m")
                .param("m", member).update();
            assertEquals(new EndingService.EndingStatus(true, false), ending.status(member));
            tx.executeWithoutResult(status -> ending.complete(member));
            tx.executeWithoutResult(status -> ending.complete(member));
            assertEquals(new EndingService.EndingStatus(true, true), ending.status(member));
            assertEquals(100000, jdbc.sql("SELECT coins FROM lab.tb_lab_member_inventory WHERE member_id = :m")
                .param("m", member).query(Integer.class).single());
        } finally {
            jdbc.sql("DELETE FROM lab.tb_lab_member WHERE id = :m").param("m", member).update();
        }
    }
}
