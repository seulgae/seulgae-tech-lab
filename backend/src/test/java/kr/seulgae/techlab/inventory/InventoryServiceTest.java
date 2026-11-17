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
}
