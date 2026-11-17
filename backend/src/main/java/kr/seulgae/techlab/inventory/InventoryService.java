package kr.seulgae.techlab.inventory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 인벤토리 규칙(일지 #7): 낚은 물고기 보관, 버리기(방 바닥)·줍기, 동전.
 * 사무실 게시물 하나에 10원(도배 방지로 하루 10번까지), 오락실 게임 한 판에 1원.
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
@Service
public class InventoryService {
    public static final String FISH = "FISH", WORK_POST = "WORK_POST", ARCADE_PLAY = "ARCADE_PLAY";
    public static final int WORK_POST_REWARD = 10, DAILY_REWARD_LIMIT = 10, ARCADE_COST = 1, MAX_ITEMS = 40, MAX_GROUND_ITEMS = 30;
    /** 낚시 미니게임(프론트 fishingLogic.ts)의 어종별 크기 범위. 이 범위 밖의 물고기는 받지 않는다. */
    static final Map<String, int[]> FISH_SIZES = Map.of(
        "피라미", new int[]{8, 15}, "붕어", new int[]{15, 32}, "쏘가리", new int[]{20, 42},
        "메기", new int[]{30, 65}, "무지개송어", new int[]{28, 55}, "황금 잉어", new int[]{45, 90});

    /** 인벤토리 화면 */
    public record View(int coins, List<InventoryStore.Item> items, int rewardsLeftToday) {}

    private final InventoryStore store;

    public InventoryService(InventoryStore store) { this.store = store; }

    public View view(UUID member) {
        return new View(store.coins(member), store.owned(member), Math.max(0, DAILY_REWARD_LIMIT - store.countToday(member, WORK_POST)));
    }

    /** 낚은 물고기를 가방에 넣는다. 어종·크기를 확인하고 가방이 꽉 차면 거절한다. */
    @Transactional
    public InventoryStore.Item storeFish(UUID member, String species, Integer cm) {
        var range = species == null ? null : FISH_SIZES.get(species);
        if (range == null || cm == null || cm < range[0] || cm > range[1]) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown fish");
        if (store.owned(member).size() >= MAX_ITEMS) throw new ResponseStatusException(HttpStatus.CONFLICT, "Inventory full");
        return store.add(member, FISH, species, cm);
    }

    /** 사무실 게시물 보상. 하루 한도를 넘으면 0원이다. @return 실제로 받은 동전 */
    @Transactional
    public int rewardWorkPost(UUID member) {
        if (store.countToday(member, WORK_POST) >= DAILY_REWARD_LIMIT) return 0;
        return store.changeCoins(member, WORK_POST_REWARD, WORK_POST).isPresent() ? WORK_POST_REWARD : 0;
    }

    /** 오락실 한 판. 동전이 없으면 409. @return 남은 동전 */
    @Transactional
    public int playArcade(UUID member) {
        return store.changeCoins(member, -ARCADE_COST, ARCADE_PLAY)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
    }

    /** 내 아이템을 지금 서 있는 곳 바닥에 내려놓는다. 바닥이 너무 어질러졌으면 거절한다. */
    @Transactional
    public Optional<InventoryStore.Item> drop(UUID member, UUID itemId, String roomId, double x, double y) {
        if (store.ground(roomId).size() >= MAX_GROUND_ITEMS) return Optional.empty();
        return store.drop(member, itemId, roomId, x, y);
    }

    @Transactional
    public Optional<InventoryStore.Item> pick(UUID member, UUID itemId, String roomId) {
        if (store.owned(member).size() >= MAX_ITEMS) return Optional.empty();
        return store.pick(member, itemId, roomId);
    }

    public List<InventoryStore.Item> ground(String roomId) { return store.ground(roomId); }
}
