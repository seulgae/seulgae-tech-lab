package kr.seulgae.techlab.savings.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.savings.repository.impl.InMemorySavingsRepository;
import org.junit.jupiter.api.Test;

/**
 * 적금: 가입(동전 차감), 만기 수령(원금+이자), 중도 해지(원금만), 두 번 찾기 방지, 개수·금액 제한.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
class SavingsServiceTest {
    private final InMemoryInventoryRepository inventory = new InMemoryInventoryRepository();
    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-24T03:00:00Z"));
    private final SavingsServiceImpl service = new SavingsServiceImpl(new InMemorySavingsRepository(), inventory, clock);
    private final UUID me = UUID.randomUUID();

    @Test
    void maturedSavingsPayPrincipalPlusInterest() {
        inventory.changeCoins(me, 200, "TEST");
        var view = service.deposit(me, 100, 3);
        assertThat(view.coins()).isEqualTo(100);
        var id = view.savings().get(0).id();
        clock.advance(Duration.ofDays(3));
        var after = service.withdraw(me, id);
        assertThat(after.coins()).isEqualTo(210);
        assertThat(after.savings().get(0).payout()).isEqualTo(110);
        assertThatThrownBy(() -> service.withdraw(me, id)).hasMessageContaining("409");
        assertThat(service.view(me).coins()).isEqualTo(210);
    }

    @Test
    void earlyWithdrawReturnsOnlyPrincipal() {
        inventory.changeCoins(me, 50, "TEST");
        var id = service.deposit(me, 50, 7).savings().get(0).id();
        clock.advance(Duration.ofDays(6));
        assertThat(service.withdraw(me, id).coins()).isEqualTo(50);
    }

    @Test
    void limitsAndOwnership() {
        inventory.changeCoins(me, 10, "TEST");
        assertThatThrownBy(() -> service.deposit(me, 0, 1)).hasMessageContaining("400");
        assertThatThrownBy(() -> service.deposit(me, 5, 2)).hasMessageContaining("400");
        assertThatThrownBy(() -> service.deposit(me, 11, 1)).hasMessageContaining("409");
        for (int i = 0; i < 3; i++) service.deposit(me, 1, 1);
        assertThatThrownBy(() -> service.deposit(me, 1, 1)).hasMessageContaining("Too many");
        var id = service.view(me).savings().get(0).id();
        assertThatThrownBy(() -> service.withdraw(UUID.randomUUID(), id)).hasMessageContaining("404");
    }

    /** 테스트에서 시간을 앞으로 돌리는 시계 */
    static final class MutableClock extends Clock {
        private Instant now;
        MutableClock(Instant now) { this.now = now; }
        void advance(Duration duration) { now = now.plus(duration); }
        @Override public ZoneId getZone() { return ZoneId.of("Asia/Seoul"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
