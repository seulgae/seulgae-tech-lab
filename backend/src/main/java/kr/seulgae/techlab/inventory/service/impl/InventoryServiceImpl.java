package kr.seulgae.techlab.inventory.service.impl;

import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.entity.*;
import kr.seulgae.techlab.inventory.service.*;
import kr.seulgae.techlab.inventory.repository.*;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.Snack;
import kr.seulgae.techlab.rule.service.GameRules;
import kr.seulgae.techlab.rule.service.VitalsGate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import java.util.random.RandomGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 물고기 보관, 방 바닥의 아이템 이동, 동전 보상·지출과 회복을 처리한다.
 * 행동 비용, 간식의 가격·회복량, 직급별 최대치는 게임 규칙을 읽어 적용한다.
 *
 * @author seulgae
 * @version 1.1, 자판기 음료 구매와 서버 가격 검증
 * @see GameRules
 */
@Service
public class InventoryServiceImpl implements InventoryService {
    /** 어종별 값(최소~최대 원). 크기 범위(FISH_SIZES)의 작은 쪽이 최소, 큰 쪽이 최대 값이다. */
    static final Map<String, int[]> FISH_PRICES = Map.of(
        "피라미", new int[]{1, 3}, "붕어", new int[]{2, 6}, "쏘가리", new int[]{4, 10},
        "메기", new int[]{6, 14}, "무지개송어", new int[]{8, 16}, "황금 잉어", new int[]{15, 30});
    /** 낚시 미니게임(프론트 fishingLogic.ts)의 어종별 크기 범위. 이 범위 밖의 물고기는 받지 않는다. */
    static final Map<String, int[]> FISH_SIZES = Map.of(
        "피라미", new int[]{8, 15}, "붕어", new int[]{15, 32}, "쏘가리", new int[]{20, 42},
        "메기", new int[]{30, 65}, "무지개송어", new int[]{28, 55}, "황금 잉어", new int[]{45, 90});



    private final InventoryRepository store;
    private final RandomGenerator random;
    private final LongSupplier clock;
    private final Map<UUID, Long> lastShake = new ConcurrentHashMap<>();

    private GameRules rules = GameRules.defaults();

    @Autowired
    public InventoryServiceImpl(InventoryRepository store, GameRules rules) { this(store, new java.security.SecureRandom(), System::currentTimeMillis); this.rules = rules; }

    public InventoryServiceImpl(InventoryRepository store) { this(store, new java.security.SecureRandom(), System::currentTimeMillis); }

    /** 테스트용: 추첨과 시계를 바꿔 끼운다. */
    public InventoryServiceImpl(InventoryRepository store, RandomGenerator random, LongSupplier clock) { this.store = store; this.random = random; this.clock = clock; }

    /**
     * 화분을 흔든다. 추첨은 서버가 한다(화면이 결과를 정하지 못하게).
     * 2초 안에 다시 흔들면 추첨하지 않고, 오늘 10번 당첨됐으면 더 주지 않는다.
     */
    @Transactional
    public PlantResultDTO shakePlant(UUID member) {
        long now = clock.getAsLong();
        Long last = lastShake.put(member, now);
        if (last != null && now - last < PLANT_COOLDOWN_MS) return new PlantResultDTO(0, store.coins(member));
        if (store.countToday(member, PLANT_LUCK) >= PLANT_DAILY_WINS || random.nextDouble() >= PLANT_LUCK_CHANCE) return new PlantResultDTO(0, store.coins(member));
        int amount = PLANT_LUCK_MIN + random.nextInt(PLANT_LUCK_MAX - PLANT_LUCK_MIN + 1);
        return store.changeCoins(member, amount, PLANT_LUCK).map(coins -> new PlantResultDTO(amount, coins))
            .orElseGet(() -> new PlantResultDTO(0, store.coins(member)));
    }

    public InventoryViewDTO view(UUID member) {
        var vitals = store.vitals(member);
        return new InventoryViewDTO(store.coins(member), store.owned(member), Math.max(0, DAILY_REWARD_LIMIT - store.countToday(member, WORK_POST)),
            vitals.hp(), vitals.hpMax(), vitals.fatigue(), vitals.fatigueMax(), unlimited(member));
    }

    /** 낚은 물고기를 가방에 넣는다. 어종·크기를 확인하고 가방이 꽉 차면 거절한다. */
    @Transactional
    public Item storeFish(UUID member, String species, Integer cm) {
        var range = species == null ? null : FISH_SIZES.get(species);
        if (range == null || cm == null || cm < range[0] || cm > range[1]) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown fish");
        if (store.owned(member).size() >= MAX_ITEMS) throw new ResponseStatusException(HttpStatus.CONFLICT, "Inventory full");
        /* 낚은 물고기를 넣을 때 기력이 든다(FISH_CATCH). 모자라면 423, 넣지 않는다. */
        gate().ensureFit(member, ActionCost.FISH_CATCH);
        Item item = store.add(member, FISH, species, cm);
        gate().spend(member, ActionCost.FISH_CATCH);
        return item;
    }

    /**
     * 사무실 게시물 보상. 하루 한도를 넘으면 0원이다.
     *
     * @return 실제로 받은 동전
     */
    @Transactional
    public int rewardWorkPost(UUID member) {
        if (store.countToday(member, WORK_POST) >= DAILY_REWARD_LIMIT) return 0;
        return store.changeCoins(member, WORK_POST_REWARD, WORK_POST).isPresent() ? WORK_POST_REWARD : 0;
    }

    /**
     * 오락실 한 판. 오늘 5판을 다 했으면 429, HP·기력이 모자라면 423, 동전이 없으면 409(모두 아무것도 바꾸지 않음).
     *
     * @return 남은 동전
     */
    @Transactional
    public int playArcade(UUID member) {
        if (arcadePlaysLeft(member) <= 0) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily arcade limit");
        ensureFit(member, ActionCost.ARCADE_PLAY);
        int coins = store.changeCoins(member, -ARCADE_COST, ARCADE_PLAY)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        spend(member, ActionCost.ARCADE_PLAY);
        return coins;
    }

    /** 오늘 남은 오락실 판 수(네 게임 합쳐 하루 5판) */
    public int arcadePlaysLeft(UUID member) { return Math.max(0, DAILY_ARCADE_PLAYS - store.countToday(member, ARCADE_PLAY)); }

    /** 이 행동을 할 만큼 HP·기력이 남았는지 확인한다(비용은 tb_lab_action_cost). 모자라면 423. */
    public void ensureFit(UUID member, String action) { gate().ensureFit(member, action); }

    /** 행동을 한 뒤 비용(tb_lab_action_cost)을 뺀다(모자라면 빼지 않는다). */
    @Transactional
    public void spendWork(UUID member, String action) { spend(member, action); }

    /** 연구소장은 HP·기력이 무제한이라 일·오락에서 줄지 않는다. */
    private boolean unlimited(UUID member) { return rules.rankOf(store.workCount(member)).unlimited(); }

    private void spend(UUID member, String action) { gate().spend(member, action); }

    /** 행동 비용 확인기(지금 규칙으로) */
    private VitalsGate gate() { return new VitalsGate(store, rules); }

    /**
     * 로비 간식·음료를 운영 DB(tb_lab_snack) 가격으로 구매한다. 회복은 최대치에서 멈춘다.
     * 이미 가득이면 422(돈을 받지 않음), 동전이 모자라면 409.
     * @param member 구매 회원
     * @param kind 서버가 허용한 간식·음료 코드
     * @return 구매 후 잔액과 회복 상태
     */
    @Transactional
    public InventoryViewDTO buySnack(UUID member, String kind) {
        /* 가격·회복량은 운영 DB tb_lab_snack. 회복하는 값이 모두 가득이면 돈을 받지 않는다. */
        Snack snack = rules.snack(kind == null ? "" : kind).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown snack"));
        var vitals = store.lockVitals(member);
        boolean hpFull = snack.hpGain() == 0 || vitals.hp() >= vitals.hpMax();
        boolean fatigueFull = snack.fatigueGain() == 0 || vitals.fatigue() >= vitals.fatigueMax();
        if (hpFull && fatigueFull) throw new ResponseStatusException(ALREADY_FULL, "Already full");
        store.changeCoins(member, -snack.price(), snack.code())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        store.changeVitals(member, snack.hpGain(), snack.fatigueGain());
        return view(member);
    }

    /** 내 아이템을 지금 서 있는 곳 바닥에 내려놓는다. 바닥이 너무 어질러졌으면 거절한다. */
    @Transactional
    public Optional<Item> drop(UUID member, UUID itemId, String roomId, double x, double y) {
        if (store.ground(roomId).size() >= MAX_GROUND_ITEMS) return Optional.empty();
        return store.drop(member, itemId, roomId, x, y);
    }

    @Transactional
    public Optional<Item> pick(UUID member, UUID itemId, String roomId) {
        if (store.owned(member).size() >= MAX_ITEMS) return Optional.empty();
        return store.pick(member, itemId, roomId);
    }

    public List<Item> ground(String roomId) { return store.ground(roomId); }

    /**
     * 물고기 값: 어종의 최소~최대 값 사이를 크기(cm)에 비례해 반올림한다. 어떤 경우에도 1~30원이다.
     * 예: 붕어 15cm 2원, 32cm 6원 / 황금 잉어 90cm 30원
     */
    public static int fishPrice(String species, Integer cm) {
        var price = FISH_PRICES.get(species);
        var size = FISH_SIZES.get(species);
        if (price == null || size == null || cm == null) return 0;
        double ratio = Math.max(0, Math.min(1, (cm - size[0]) / (double) (size[1] - size[0])));
        long value = Math.round(price[0] + ratio * (price[1] - price[0]));
        return (int) Math.max(1, Math.min(FISH_PRICE_MAX, value));
    }

    /** 포장마차가 열려 있는지(한국 시간 18시~자정) */
    public boolean cartOpen() {
        return java.time.Instant.ofEpochMilli(clock.getAsLong()).atZone(java.time.ZoneId.of("Asia/Seoul")).getHour() >= CART_OPEN_HOUR;
    }


    /**
     * 포장마차에 물고기를 판다. 저녁이 아니면 409(closed), 내 물고기가 아니면 404. 물고기를 지우고 값만큼 동전을 준다(한 트랜잭션).
     */
    @Transactional
    public SaleDTO sellFish(UUID member, UUID itemId) {
        if (!cartOpen()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Food cart is closed");
        var item = item(member, itemId).filter(found -> FISH.equals(found.kind()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fish not found"));
        int price = fishPrice(item.name(), item.sizeCm());
        if (price <= 0 || store.remove(member, itemId) != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fish not found");
        store.changeCoins(member, price, FISH_SALE).orElseThrow();
        return new SaleDTO(price, view(member));
    }

    /** 이 회원 가방에 이 아이템이 있는지 */
    public boolean owns(UUID member, UUID itemId) { return store.owned(member).stream().anyMatch(item -> item.id().equals(itemId)); }

    /** 이 회원 가방의 아이템(교환 신청 화면에 보여 줄 값) */
    public Optional<Item> item(UUID member, UUID itemId) {
        return store.owned(member).stream().filter(item -> item.id().equals(itemId)).findFirst();
    }

    /**
     * 회의실 교환: a의 itemA와 b의 itemB를 맞바꾼다. 둘 중 하나라도 이미 주인이 바뀌었으면 409(아무것도 바꾸지 않음).
     */
    @Transactional
    public void trade(UUID a, UUID itemA, UUID b, UUID itemB) {
        if (a.equals(b) || itemA.equals(itemB)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid trade");
        if (store.swap(a, itemA, b, itemB) != 2) throw new ResponseStatusException(HttpStatus.CONFLICT, "Trade failed");
    }


    public List<GroundItemDTO> groundView(String roomId) {
        return store.ground(roomId).stream().map(item -> new GroundItemDTO(item.id().toString(), item.kind(), item.name(), item.sizeCm(), item.x(), item.y())).toList();
    }

    /** 내 위치(x, y) 근처의 바닥 아이템을 줍는다. 멀거나 이미 누가 주웠으면 빈 값 */
    @Transactional
    public Optional<Item> pickNear(UUID member, UUID itemId, String roomId, double x, double y) {
        boolean near = store.ground(roomId).stream().anyMatch(item -> item.id().equals(itemId) && Math.hypot(item.x() - x, item.y() - y) <= PICK_RANGE);
        return near ? pick(member, itemId, roomId) : Optional.empty();
    }
}
