package kr.seulgae.techlab.inventory;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 인벤토리: 물고기 보관, 버리기·줍기(한 명만 성공), 게시물 보상 10원(하루 10번), 오락실 1원.
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
class InventoryServiceTest {
    private final InventoryService service = new InventoryService(new InMemoryInventoryStore());
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
        assertEquals(45, service.view(me).fatigue(), "일하면 피로도 -5");

        var full = assertThrows(ResponseStatusException.class, () -> service.buySnack(friend, "CAKE"));
        assertEquals(InventoryService.ALREADY_FULL, full.getStatusCode(), "가득이면 사지 않는다(동전도 그대로)");

        var broke = assertThrows(ResponseStatusException.class, () -> service.buySnack(me, "CAKE"));
        assertEquals(409, broke.getStatusCode().value(), "동전이 없으면 살 수 없다");

        service.rewardWorkPost(me); // 10원
        var cake = service.buySnack(me, "CAKE");
        assertEquals(50, cake.hp(), "HP +10이지만 최대 50에서 멈춘다");
        assertEquals(7, cake.coins(), "케이크 3원");
        var coffee = service.buySnack(me, "COFFEE");
        assertEquals(50, coffee.fatigue(), "커피 피로도 +5");
        assertEquals(5, coffee.coins(), "커피 2원");
        assertThrows(ResponseStatusException.class, () -> service.buySnack(me, "BEER"));

        int coinsBefore = service.view(me).coins();
        service.playArcade(me);
        var afterGame = service.view(me);
        assertEquals(coinsBefore - 1, afterGame.coins());
        assertEquals(47, afterGame.hp(), "오락도 HP -3");
        assertEquals(45, afterGame.fatigue(), "오락도 피로도 -5");
    }

    @Test void tooTiredMembersCannotWorkOrPlayUntilTheyRest() {
        for (int i = 0; i < 10; i++) service.spendWork(me); // 피로도 50 → 0
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
}
