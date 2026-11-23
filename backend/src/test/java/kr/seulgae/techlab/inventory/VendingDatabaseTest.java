package kr.seulgae.techlab.inventory;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * CI 일회용 PostgreSQL에서 음료 공통코드·결제 내역·동시 구매 잠금을 검증한다.
 * 개발·운영 인증정보를 읽지 않고 고정된 CI DB의 테스트 회원만 생성·삭제한다.
 * @author seulgae
 * @version 1.0, 실제 DB 자판기 결제 검증
 * @see "None"
 */
@EnabledIfEnvironmentVariable(named = "RECRUITMENT_TEST_DB", matches = "true")
class VendingDatabaseTest {
    /** 음료 네 종류의 기록을 확인하고 동시 구매 두 건 중 한 건만 결제되도록 검증한다. */
    @Test void recordsDrinkNamesAndSerializesConcurrentPurchases() throws Exception {
        var ds = new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:5432/research_ci?currentSchema=lab", "test_app", "ci-app-only");
        var jdbc = JdbcClient.create(ds);
        var store = new JdbcInventoryStore(jdbc);
        var service = new InventoryService(store);
        var tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        UUID member = UUID.randomUUID();
        jdbc.sql("INSERT INTO lab.tb_lab_member (id, kakao_id, nickname) VALUES (:m, :k, '자판기검증')")
            .param("m", member).param("k", -Math.abs(member.getMostSignificantBits())).update();
        var pool = Executors.newFixedThreadPool(2);
        try {
            for (String kind : new String[]{"COLA", "CIDER", "FANTA", "WATER"}) {
                tx.executeWithoutResult(status -> { service.rewardWorkPost(member); service.spendWork(member); service.buySnack(member, kind); });
                var event = store.history(member, 100).stream().filter(entry -> kind.equals(entry.reason())).findFirst().orElseThrow();
                assertEquals(kind, event.reason());
                assertEquals("WATER".equals(kind) ? -1 : -2, event.amount());
                assertEquals(switch (kind) { case "COLA" -> "콜라"; case "CIDER" -> "사이다"; case "FANTA" -> "환타"; default -> "물"; }, event.reasonName());
            }
            jdbc.sql("UPDATE lab.tb_lab_member_inventory SET fatigue = 45 WHERE member_id = :m").param("m", member).update();
            int balance = store.coins(member);
            int events = store.history(member, 100).size();
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            java.util.concurrent.Callable<Integer> buy = () -> {
                ready.countDown();
                assertTrue(start.await(5, TimeUnit.SECONDS));
                try { tx.executeWithoutResult(status -> service.buySnack(member, "COLA")); return 200; }
                catch (ResponseStatusException error) { return error.getStatusCode().value(); }
            };
            var first = pool.submit(buy);
            var second = pool.submit(buy);
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(java.util.Set.of(200, 422), java.util.Set.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)));
            assertEquals(balance - 2, store.coins(member));
            assertEquals(events + 1, store.history(member, 100).size());
            assertEquals(50, store.vitals(member).fatigue());
        } finally {
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(15, TimeUnit.SECONDS));
            jdbc.sql("DELETE FROM lab.tb_lab_member WHERE id = :m").param("m", member).update();
        }
    }
}
