package kr.seulgae.techlab.rule.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Random;
import java.util.UUID;
import kr.seulgae.techlab.dorm.repository.impl.InMemoryDormRepository;
import kr.seulgae.techlab.dorm.service.impl.DormServiceImpl;
import kr.seulgae.techlab.gamble.service.impl.GambleServiceImpl;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.inventory.service.impl.InventoryServiceImpl;
import kr.seulgae.techlab.office.desk.service.impl.DeskServiceImpl;
import org.junit.jupiter.api.Test;

/**
 * HP·기력 행동 비용 확대(V24): 내기·낚시·자바 연습·가구 배치가 기본 규칙만큼 빼고, 모자라면 423으로 막으며 아무것도 바꾸지 않는다.
 * 연구소장은 빼지 않는다. 침대 휴식은 놓인 침대가 있어야 하고 간격마다 한 번만 회복한다.
 *
 * @author 길태형
 * @version 1.0, HP·기력 행동 비용 확대
 * @see None
 */
class VitalsGateTest {
    private final InMemoryInventoryRepository inventory = new InMemoryInventoryRepository();
    private final UUID me = UUID.randomUUID();

    @Test
    void newActionsSpendTheirCostAndAreBlockedWhenTired() {
        inventory.changeCoins(me, 100, "TEST");
        var gamble = new GambleServiceImpl(inventory, new Random(3));
        gamble.play(me, "ODD_EVEN", 1, "ODD");
        assertThat(inventory.vitals(me).fatigue()).isEqualTo(50 - 3);

        new InventoryServiceImpl(inventory).storeFish(me, "붕어", 20);
        assertThat(inventory.vitals(me).fatigue()).isEqualTo(47 - 4);

        var desk = new DeskServiceImpl(inventory);
        desk.answer(me, "hello", "틀린 답");
        assertThat(inventory.vitals(me).fatigue()).as("틀려도 제출마다 기력 2").isEqualTo(43 - 2);

        /* 기력을 1만 남기면 내기는 막히고 동전·판 수도 그대로다 */
        inventory.changeVitals(me, 0, -40);
        int coins = inventory.coins(me);
        assertThatThrownBy(() -> gamble.play(me, "ODD_EVEN", 1, "ODD")).hasMessageContaining("423");
        assertThat(inventory.coins(me)).isEqualTo(coins);
        assertThatThrownBy(() -> desk.answer(me, "hello", "x")).hasMessageContaining("423");
    }

    @Test
    void directorIsNotCharged() {
        for (int i = 0; i < 100; i++) inventory.addWork(me);
        inventory.changeCoins(me, 10, "TEST");
        new GambleServiceImpl(inventory, new Random(3)).play(me, "ODD_EVEN", 1, "ODD");
        assertThat(inventory.vitals(me).fatigue()).isEqualTo(50);
    }

    @Test
    void placingFurnitureCostsHpAndBedRestRecoversOncePerInterval() {
        var now = new Instant[]{Instant.parse("2026-11-24T03:00:00Z")};
        Clock clock = new Clock() {
            @Override public ZoneId getZone() { return ZoneId.of("Asia/Seoul"); }
            @Override public Clock withZone(ZoneId zone) { return this; }
            @Override public Instant instant() { return now[0]; }
        };
        var rules = GameRules.defaults();
        var dorm = new DormServiceImpl(new InMemoryDormRepository(), inventory, VitalsGate.defaults(inventory), rules, clock);
        inventory.changeCoins(me, 100, "TEST");
        assertThatThrownBy(() -> dorm.rest(me)).as("침대가 없으면 쉴 수 없다").hasMessageContaining("409");

        var view = dorm.buy(me, "BED");
        var bed = view.furniture().get(0).id();
        dorm.place(me, bed, 200, 300);
        assertThat(inventory.vitals(me).hp()).isEqualTo(50 - 2);

        inventory.changeVitals(me, -20, -30);
        var first = dorm.rest(me);
        assertThat(first.recovered()).isTrue();
        assertThat(first.hp()).isEqualTo(28 + 3);
        assertThat(first.fatigue()).isEqualTo(20 + 3);
        assertThat(dorm.rest(me).recovered()).as("간격 안에서는 다시 오르지 않는다").isFalse();
        now[0] = now[0].plusSeconds(60);
        assertThat(dorm.rest(me).hp()).isEqualTo(34);
    }
}
