package kr.seulgae.techlab.badge.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.inventory.service.impl.InventoryServiceImpl;
import kr.seulgae.techlab.office.desk.service.impl.DeskServiceImpl;
import org.junit.jupiter.api.Test;

/**
 * 사원증·급여: 직급 경계, 10분마다 한 번 급여, 승진 때 HP·기력 최대치 상승, 연구소장 무제한, 오늘 업무 보상과 승진 연결.
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see None
 */
class BadgeServiceTest {
    private final Instant start = Instant.parse("2026-11-24T03:00:00Z");
    private final Instant[] now = { start };
    private final Clock clock = new Clock() {
        @Override public ZoneId getZone() { return ZoneId.of("Asia/Seoul"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now[0]; }
    };
    private final InMemoryInventoryRepository inventory = new InMemoryInventoryRepository();
    private final BadgeServiceImpl badge = new BadgeServiceImpl(inventory, clock);
    private final UUID me = UUID.randomUUID();

    @Test
    void rankBoundaries() {
        assertThat(Rank.of(Rank.DEFAULTS, 0).name()).isEqualTo("인턴");
        assertThat(Rank.of(Rank.DEFAULTS, 1).name()).isEqualTo("주임");
        assertThat(Rank.of(Rank.DEFAULTS, 4).name()).isEqualTo("주임");
        assertThat(Rank.of(Rank.DEFAULTS, 5).name()).isEqualTo("선임");
        assertThat(Rank.of(Rank.DEFAULTS, 10).name()).isEqualTo("책임");
        assertThat(Rank.of(Rank.DEFAULTS, 29).name()).isEqualTo("책임");
        assertThat(Rank.of(Rank.DEFAULTS, 30).name()).isEqualTo("수석");
        assertThat(Rank.of(Rank.DEFAULTS, 100).name()).isEqualTo("연구소장");
        assertThat(Rank.next(Rank.DEFAULTS, 100)).isNull();
        assertThat(Rank.next(Rank.DEFAULTS, 3).name()).isEqualTo("선임");
        assertThat(Rank.DEFAULTS).extracting(Rank::pay).containsExactly(1, 5, 10, 20, 50, 100);
        assertThat(Rank.DEFAULTS).extracting(Rank::vitalsMax).containsExactly(50, 100, 150, 220, 500, Rank.UNLIMITED_MAX);
    }

    @Test
    void salaryOncePerTenMinutes() {
        assertThat(badge.tick(me).paid()).isEqualTo(1);
        assertThat(badge.tick(me).paid()).isZero();
        now[0] = start.plus(Duration.ofMinutes(9));
        var waiting = badge.tick(me);
        assertThat(waiting.paid()).isZero();
        assertThat(waiting.nextSalarySeconds()).isEqualTo(60);
        now[0] = start.plus(Duration.ofMinutes(10));
        var second = badge.tick(me);
        assertThat(second.paid()).isEqualTo(1);
        assertThat(second.coins()).isEqualTo(2);
        assertThat(second.salaryCountToday()).isEqualTo(2);
    }

    @Test
    void promotionRaisesVitalsAndPay() {
        assertThat(badge.completeWork(me).name()).isEqualTo("주임");
        assertThat(inventory.vitals(me).hpMax()).isEqualTo(100);
        assertThat(inventory.vitals(me).fatigue()).isEqualTo(100);
        assertThat(badge.completeWork(me)).isNull();
        assertThat(badge.tick(me).paid()).isEqualTo(5);
    }

    @Test
    void directorHasUnlimitedVitals() {
        var service = new InventoryServiceImpl(inventory);
        for (int i = 0; i < 100; i++) badge.completeWork(me);
        assertThat(Rank.of(Rank.DEFAULTS, inventory.workCount(me)).unlimited()).isTrue();
        inventory.changeCoins(me, 1, "TEST");
        int before = inventory.vitals(me).fatigue();
        service.playArcade(me);
        assertThat(inventory.vitals(me).fatigue()).isEqualTo(before);
        assertThat(service.view(me).unlimited()).isTrue();
    }

    @Test
    void finishingDailyTasksCountsAsWork() {
        var desk = new DeskServiceImpl(inventory, clock, badge);
        assertThatThrownBy(() -> desk.claim(me)).hasMessageContaining("409");
        inventory.changeCoins(me, 20, "TEST");
        for (String reason : new String[]{"FISH_SALE", "ARCADE_PLAY", "COFFEE", "WORK_POST", "JAVA_PRACTICE"}) inventory.changeCoins(me, 0, reason);
        var claimed = desk.claim(me);
        assertThat(claimed.promotedTo()).isEqualTo("주임");
        assertThat(inventory.workCount(me)).isEqualTo(1);
    }
}
