package kr.seulgae.techlab.inventory.service.impl;

import kr.seulgae.techlab.inventory.repository.impl.*;
import kr.seulgae.techlab.inventory.service.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 인벤토리: 물고기 보관, 버리기·줍기(한 명만 성공), 게시물 보상 10원(하루 10번), 오락실 1원.
 * @author seulgae
 * @version 1.1, 자판기 가격·회복·실패 시 잔액 검증
 * @see "None"
 */
class InventoryServiceTest {
    private final InventoryService service = new InventoryServiceImpl(new InMemoryInventoryRepository());
    private final UUID me = UUID.randomUUID(), friend = UUID.randomUUID();

    @Test void storesCaughtFishAndRejectsImpossibleOnes() {
        var fish = service.storeFish(me, "붕어", 23);
        assertEquals("FISH", fish.kind());
        assertEquals(1, service.view(me).items().size());
        assertThrows(ResponseStatusException.class, () -> service.storeFish(me, "고래", 500), "없는 어종");
        assertThrows(ResponseStatusException.class, () -> service.storeFish(me, "피라미", 90), "어종 크기 범위 밖");
        for (int i = 1; i < InventoryService.MAX_ITEMS; i++) service.storeFish(me, "피라미", 10);
        assertThrows(ResponseStatusException.class, () -> service.storeFish(me, "피라미", 10), "가방이 꽉 참");
    }

    @Test void droppedItemLiesOnTheFloorUntilSomeonePicksItUp() {
        var fish = service.storeFish(me, "메기", 40);
        assertTrue(service.drop(friend, fish.id(), "outdoor", 600, 470).isEmpty(), "남의 아이템은 버릴 수 없다");
        var dropped = service.drop(me, fish.id(), "outdoor", 600, 470).orElseThrow();
        assertEquals(600, dropped.x());
        assertTrue(service.view(me).items().isEmpty());
        assertEquals(1, service.ground("outdoor").size());
        assertTrue(service.ground("lobby").isEmpty(), "다른 방 바닥에는 없다");
        assertTrue(service.pick(friend, fish.id(), "lobby").isEmpty(), "다른 방에서는 주울 수 없다");
        assertTrue(service.pick(friend, fish.id(), "outdoor").isPresent());
        assertTrue(service.pick(me, fish.id(), "outdoor").isEmpty(), "이미 주운 것은 다시 주울 수 없다");
        assertEquals("메기", service.view(friend).items().get(0).name());
        assertTrue(service.ground("outdoor").isEmpty());
    }

    @Test void workPostsPayTenCoinsUpToTenTimesADayAndArcadeCostsOne() {
        assertThrows(ResponseStatusException.class, () -> service.playArcade(me), "동전이 없으면 게임을 시작할 수 없다");
        for (int i = 0; i < InventoryService.DAILY_REWARD_LIMIT; i++) assertEquals(10, service.rewardWorkPost(me));
        assertEquals(0, service.rewardWorkPost(me), "하루 10번을 넘으면 보상 없음(도배 방지)");
        assertEquals(100, service.view(me).coins());
        assertEquals(0, service.view(me).rewardsLeftToday());
        assertEquals(99, service.playArcade(me));
        assertEquals(99, service.view(me).coins());
    }

    @Test void workAndArcadeCostHpAndFatigueAndSnacksRecoverThem() {
        var start = service.view(me);
        assertEquals(50, start.hp()); assertEquals(50, start.hpMax());
        assertEquals(50, start.fatigue()); assertEquals(50, start.fatigueMax());

        service.ensureFit(me);
        service.spendWork(me);
        assertEquals(47, service.view(me).hp(), "일하면 HP -3");
        assertEquals(45, service.view(me).fatigue(), "일하면 스태미나 -5");

        var full = assertThrows(ResponseStatusException.class, () -> service.buySnack(friend, "CAKE"));
        assertEquals(InventoryService.ALREADY_FULL, full.getStatusCode(), "가득이면 사지 않는다(동전도 그대로)");

        var broke = assertThrows(ResponseStatusException.class, () -> service.buySnack(me, "CAKE"));
        assertEquals(409, broke.getStatusCode().value(), "동전이 없으면 살 수 없다");

        service.rewardWorkPost(me); // 10원
        var cake = service.buySnack(me, "CAKE");
        assertEquals(50, cake.hp(), "HP +10이지만 최대 50에서 멈춘다");
        assertEquals(7, cake.coins(), "케이크 3원");
        var coffee = service.buySnack(me, "COFFEE");
        assertEquals(50, coffee.fatigue(), "커피 스태미나 +5");
        assertEquals(5, coffee.coins(), "커피 2원");
        assertThrows(ResponseStatusException.class, () -> service.buySnack(me, "BEER"));

        int coinsBefore = service.view(me).coins();
        service.playArcade(me);
        var afterGame = service.view(me);
        assertEquals(coinsBefore - 1, afterGame.coins());
        assertEquals(47, afterGame.hp(), "오락도 HP -3");
        assertEquals(45, afterGame.fatigue(), "오락도 스태미나 -5");
    }

    @Test void tooTiredMembersCannotWorkOrPlayUntilTheyRest() {
        for (int i = 0; i < 10; i++) service.spendWork(me); // 스태미나 50 → 0
        assertEquals(0, service.view(me).fatigue());
        assertEquals(20, service.view(me).hp());
        var tired = assertThrows(ResponseStatusException.class, () -> service.ensureFit(me));
        assertEquals(InventoryService.TIRED, tired.getStatusCode());
        service.rewardWorkPost(me);
        int coins = service.view(me).coins();
        assertEquals(InventoryService.TIRED, assertThrows(ResponseStatusException.class, () -> service.playArcade(me)).getStatusCode());
        assertEquals(coins, service.view(me).coins(), "지쳐서 못 하면 동전도 그대로");
        service.buySnack(me, "COFFEE");
        service.ensureFit(me);
    }

    @Test void picksOnlyItemsNearTheReportedPosition() {
        var fish = service.storeFish(me, "붕어", 20);
        service.drop(me, fish.id(), "outdoor", 600, 470).orElseThrow();
        assertEquals(1, service.groundView("outdoor").size());
        assertEquals(fish.id().toString(), service.groundView("outdoor").get(0).id());
        assertTrue(service.pickNear(friend, fish.id(), "outdoor", 700, 470).isEmpty(), "48px보다 멀면 주울 수 없다");
        assertTrue(service.pickNear(friend, fish.id(), "lobby", 600, 470).isEmpty(), "다른 방에서는 주울 수 없다");
        assertTrue(service.pickNear(friend, fish.id(), "outdoor", 620, 480).isPresent());
        assertTrue(service.groundView("outdoor").isEmpty());
    }

    /** 정해진 순서로 값을 내는 추첨기 */
    private static java.util.random.RandomGenerator draws(double... values) {
        var queue = new java.util.ArrayDeque<Double>();
        for (double value : values) queue.add(value);
        return new java.util.random.RandomGenerator() {
            @Override public long nextLong() { return 0; }
            @Override public double nextDouble() { return queue.isEmpty() ? 0.99 : queue.poll(); }
            @Override public int nextInt(int bound) { return (int) (bound * (queue.isEmpty() ? 0 : queue.poll())); }
        };
    }

    @Test void shakingPlantsSometimesDropsOneToThreeCoins() {
        long[] now = {0};
        // 5% 미만이면 당첨, 두 번째 값이 금액(0.99 → 3원)
        var lucky = new InventoryServiceImpl(new InMemoryInventoryRepository(), draws(0.01, 0.99, 0.5, 0.04, 0.0), () -> now[0]);
        var win = lucky.shakePlant(me);
        assertEquals(3, win.won()); assertEquals(3, win.coins());
        now[0] += 500;
        assertEquals(0, lucky.shakePlant(me).won(), "2초 안에 다시 흔들면 추첨하지 않는다");
        now[0] += 2500;
        assertEquals(0, lucky.shakePlant(me).won(), "0.5는 꽝(5% 이상)");
        now[0] += 2500;
        var small = lucky.shakePlant(me);
        assertEquals(1, small.won(), "0.04는 당첨, 0.0은 1원");
        assertEquals(4, small.coins());
    }

    @Test void plantLuckStopsAfterTenWinsADay() {
        long[] now = {0};
        double[] alwaysWin = new double[40];
        for (int i = 0; i < alwaysWin.length; i += 2) { alwaysWin[i] = 0.0; alwaysWin[i + 1] = 0.5; }
        var service = new InventoryServiceImpl(new InMemoryInventoryRepository(), draws(alwaysWin), () -> now[0]);
        int wins = 0;
        for (int i = 0; i < 15; i++) { now[0] += 3000; if (service.shakePlant(me).won() > 0) wins++; }
        assertEquals(InventoryService.PLANT_DAILY_WINS, wins, "하루 10번까지만 당첨");
        assertEquals(20, service.view(me).coins(), "0.5 → 2원 × 10번");
    }

    @Test void tradeSwapsTwoBagItemsOrNothing() {
        var mine = service.storeFish(me, "붕어", 20);
        var theirs = service.storeFish(friend, "메기", 40);
        service.trade(me, mine.id(), friend, theirs.id());
        assertEquals("메기", service.view(me).items().get(0).name());
        assertEquals("붕어", service.view(friend).items().get(0).name());
        assertThrows(ResponseStatusException.class, () -> service.trade(me, mine.id(), friend, theirs.id()), "이미 주인이 바뀐 아이템은 교환되지 않는다");
        assertEquals("메기", service.view(me).items().get(0).name(), "실패하면 그대로");
        assertThrows(ResponseStatusException.class, () -> service.trade(me, theirs.id(), me, theirs.id()));
    }

    @Test void fishPricesFollowSizeAndSpeciesAndNeverExceedThirty() {
        assertEquals(2, InventoryServiceImpl.fishPrice("붕어", 15));
        assertEquals(6, InventoryServiceImpl.fishPrice("붕어", 32));
        assertEquals(4, InventoryServiceImpl.fishPrice("붕어", 24), "중간 크기는 중간 값(반올림)");
        assertEquals(1, InventoryServiceImpl.fishPrice("피라미", 8));
        assertEquals(30, InventoryServiceImpl.fishPrice("황금 잉어", 90));
        assertEquals(30, InventoryServiceImpl.fishPrice("황금 잉어", 999), "범위 밖으로 커도 30원을 넘지 않는다");
        assertEquals(0, InventoryServiceImpl.fishPrice("고래", 500));
        for (var species : InventoryServiceImpl.FISH_SIZES.keySet()) {
            var size = InventoryServiceImpl.FISH_SIZES.get(species);
            for (int cm = size[0]; cm <= size[1]; cm++) {
                int price = InventoryServiceImpl.fishPrice(species, cm);
                assertTrue(price >= 1 && price <= 30, species + " " + cm);
            }
        }
    }

    @Test void foodCartBuysFishOnlyInTheEvening() {
        // 2026-11-21 17:59 / 18:00 한국 시간
        long[] now = {java.time.ZonedDateTime.of(2026, 11, 21, 17, 59, 0, 0, java.time.ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()};
        var service = new InventoryServiceImpl(new InMemoryInventoryRepository(), new java.util.Random(1), () -> now[0]);
        var fish = service.storeFish(me, "메기", 65);
        var closed = assertThrows(ResponseStatusException.class, () -> service.sellFish(me, fish.id()));
        assertEquals(409, closed.getStatusCode().value(), "저녁 6시 전에는 닫혀 있다");
        now[0] += 60_000;
        var sale = service.sellFish(me, fish.id());
        assertEquals(14, sale.price(), "메기 65cm는 14원");
        assertEquals(14, sale.view().coins());
        assertTrue(sale.view().items().isEmpty(), "판 물고기는 가방에서 빠진다");
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.sellFish(me, fish.id())).getStatusCode().value(), "두 번 팔 수 없다");
        var theirs = service.storeFish(friend, "붕어", 20);
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.sellFish(me, theirs.id())).getStatusCode().value(), "남의 물고기는 팔 수 없다");
    }
    /** 네 음료의 가격·회복량과 부족·가득·잘못된 요청의 무차감을 검증한다. */
    @Test void vendingDrinksUseServerPricesAndNeverChargeRejectedPurchases() {
        for (String kind : new String[]{"COLA", "CIDER", "FANTA", "WATER"}) {
            UUID member = UUID.randomUUID();
            service.spendWork(member);
            assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.buySnack(member, kind)).getStatusCode().value());
            assertEquals(45, service.view(member).fatigue());
            service.rewardWorkPost(member);
            var bought = service.buySnack(member, kind);
            assertEquals("WATER".equals(kind) ? 9 : 8, bought.coins());
            assertEquals("WATER".equals(kind) ? 47 : 50, bought.fatigue());
            assertEquals(47, bought.hp());
            if ("WATER".equals(kind)) { service.buySnack(member, kind); service.buySnack(member, kind); }
            var full = service.view(member);
            assertEquals(422, assertThrows(ResponseStatusException.class, () -> service.buySnack(member, kind)).getStatusCode().value());
            assertEquals(full, service.view(member));
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.buySnack(member, null)).getStatusCode().value());
            assertEquals(full, service.view(member));
        }
    }
}
