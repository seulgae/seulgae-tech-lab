package kr.seulgae.techlab.inventory;

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
 * 인벤토리 규칙(일지 #7): 낚은 물고기 보관, 버리기(방 바닥)·줍기, 동전.
 * 사무실 게시물 하나에 10원(도배 방지로 하루 10번까지), 오락실 게임 한 판에 1원.
 * HP·피로도(일지 #10): 기본 최대 50. 사무실 게시판 일·오락 한 번에 HP -3, 피로도 -5.
 * 로비 데스크 케이크(3원)는 HP +10, 커피(2원)는 피로도 +5. 모자라면 일·오락을 할 수 없다.
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
@Service
public class InventoryService {
    public static final String FISH = "FISH", WORK_POST = "WORK_POST", ARCADE_PLAY = "ARCADE_PLAY";
    public static final int WORK_POST_REWARD = 10, DAILY_REWARD_LIMIT = 10, ARCADE_COST = 1, MAX_ITEMS = 40, MAX_GROUND_ITEMS = 30;
    /** 일·오락 한 번에 드는 HP와 피로도 */
    public static final int WORK_HP_COST = 3, WORK_FATIGUE_COST = 5;
    /** 간식: 공통코드 COIN_REASON(CAKE, COFFEE), 가격과 회복량 */
    public static final String CAKE = "CAKE", COFFEE = "COFFEE";
    public static final int CAKE_PRICE = 3, CAKE_HP = 10, COFFEE_PRICE = 2, COFFEE_FATIGUE = 5;
    /** 식물 행운: 화분을 흔들면 5% 확률로 1~3원. 하루 10번까지만 당첨되고, 2초 안에 다시 흔들면 추첨하지 않는다(연타 방지). */
    public static final String PLANT_LUCK = "PLANT_LUCK";
    public static final double PLANT_LUCK_CHANCE = 0.05;
    public static final int PLANT_LUCK_MIN = 1, PLANT_LUCK_MAX = 3, PLANT_DAILY_WINS = 10;
    public static final long PLANT_COOLDOWN_MS = 2000;
    /** 포장마차 물고기 판매: 저녁(한국 시간 18시~자정)에만 연다. 한 마리 최대 30원 */
    public static final String FISH_SALE = "FISH_SALE";
    public static final int FISH_PRICE_MAX = 30, CART_OPEN_HOUR = 18;
    /** 어종별 값(최소~최대 원). 크기 범위(FISH_SIZES)의 작은 쪽이 최소, 큰 쪽이 최대 값이다. */
    static final Map<String, int[]> FISH_PRICES = Map.of(
        "피라미", new int[]{1, 3}, "붕어", new int[]{2, 6}, "쏘가리", new int[]{4, 10},
        "메기", new int[]{6, 14}, "무지개송어", new int[]{8, 16}, "황금 잉어", new int[]{15, 30});
    /** HP·피로도가 모자라 일·오락을 할 수 없음(423 Locked) */
    public static final HttpStatus TIRED = HttpStatus.LOCKED;
    /** 이미 가득 차서 간식을 사지 않음(422) */
    public static final HttpStatus ALREADY_FULL = HttpStatus.UNPROCESSABLE_CONTENT;
    /** 낚시 미니게임(프론트 fishingLogic.ts)의 어종별 크기 범위. 이 범위 밖의 물고기는 받지 않는다. */
    static final Map<String, int[]> FISH_SIZES = Map.of(
        "피라미", new int[]{8, 15}, "붕어", new int[]{15, 32}, "쏘가리", new int[]{20, 42},
        "메기", new int[]{30, 65}, "무지개송어", new int[]{28, 55}, "황금 잉어", new int[]{45, 90});

    /** 인벤토리 화면 */
    public record View(int coins, List<InventoryStore.Item> items, int rewardsLeftToday, int hp, int hpMax, int fatigue, int fatigueMax) {}

    /** 식물 흔들기 결과: 받은 동전(꽝이면 0)과 지금 잔액 */
    public record PlantResult(int won, int coins) {}

    private final InventoryStore store;
    private final RandomGenerator random;
    private final LongSupplier clock;
    private final Map<UUID, Long> lastShake = new ConcurrentHashMap<>();

    @Autowired
    public InventoryService(InventoryStore store) { this(store, new java.security.SecureRandom(), System::currentTimeMillis); }

    /** 테스트용: 추첨과 시계를 바꿔 끼운다. */
    InventoryService(InventoryStore store, RandomGenerator random, LongSupplier clock) { this.store = store; this.random = random; this.clock = clock; }

    /**
     * 화분을 흔든다. 추첨은 서버가 한다(화면이 결과를 정하지 못하게).
     * 2초 안에 다시 흔들면 추첨하지 않고, 오늘 10번 당첨됐으면 더 주지 않는다.
     */
    @Transactional
    public PlantResult shakePlant(UUID member) {
        long now = clock.getAsLong();
        Long last = lastShake.put(member, now);
        if (last != null && now - last < PLANT_COOLDOWN_MS) return new PlantResult(0, store.coins(member));
        if (store.countToday(member, PLANT_LUCK) >= PLANT_DAILY_WINS || random.nextDouble() >= PLANT_LUCK_CHANCE) return new PlantResult(0, store.coins(member));
        int amount = PLANT_LUCK_MIN + random.nextInt(PLANT_LUCK_MAX - PLANT_LUCK_MIN + 1);
        return store.changeCoins(member, amount, PLANT_LUCK).map(coins -> new PlantResult(amount, coins))
            .orElseGet(() -> new PlantResult(0, store.coins(member)));
    }

    public View view(UUID member) {
        var vitals = store.vitals(member);
        return new View(store.coins(member), store.owned(member), Math.max(0, DAILY_REWARD_LIMIT - store.countToday(member, WORK_POST)),
            vitals.hp(), vitals.hpMax(), vitals.fatigue(), vitals.fatigueMax());
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

    /** 오락실 한 판. HP·피로도가 모자라면 423, 동전이 없으면 409(둘 다 아무것도 바꾸지 않음). @return 남은 동전 */
    @Transactional
    public int playArcade(UUID member) {
        ensureFit(member);
        int coins = store.changeCoins(member, -ARCADE_COST, ARCADE_PLAY)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        spend(member);
        return coins;
    }

    /** 일·오락을 할 수 있을 만큼 HP·피로도가 남았는지 확인한다. 모자라면 423. */
    public void ensureFit(UUID member) {
        var vitals = store.vitals(member);
        if (vitals.hp() < WORK_HP_COST || vitals.fatigue() < WORK_FATIGUE_COST) {
            throw new ResponseStatusException(TIRED, "Too tired: eat cake or drink coffee in the lobby");
        }
    }

    /** 사무실 게시판에서 일한 뒤 HP -3, 피로도 -5(모자라면 빼지 않는다). */
    @Transactional
    public void spendWork(UUID member) { spend(member); }

    private void spend(UUID member) {
        store.changeVitals(member, -WORK_HP_COST, -WORK_FATIGUE_COST)
            .orElseThrow(() -> new ResponseStatusException(TIRED, "Too tired: eat cake or drink coffee in the lobby"));
    }

    /**
     * 로비 데스크 간식. 케이크 3원 HP +10, 커피 2원 피로도 +5(최대치에서 멈춘다).
     * 이미 가득이면 422(돈을 받지 않음), 동전이 모자라면 409.
     */
    @Transactional
    public View buySnack(UUID member, String kind) {
        boolean cake = CAKE.equals(kind);
        if (!cake && !COFFEE.equals(kind)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown snack");
        var vitals = store.vitals(member);
        if (cake ? vitals.hp() >= vitals.hpMax() : vitals.fatigue() >= vitals.fatigueMax()) {
            throw new ResponseStatusException(ALREADY_FULL, "Already full");
        }
        store.changeCoins(member, -(cake ? CAKE_PRICE : COFFEE_PRICE), kind)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        store.changeVitals(member, cake ? CAKE_HP : 0, cake ? 0 : COFFEE_FATIGUE);
        return view(member);
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

    /** 판매 결과: 받은 동전과 가방 화면 */
    public record Sale(int price, View view) {}

    /**
     * 포장마차에 물고기를 판다. 저녁이 아니면 409(closed), 내 물고기가 아니면 404. 물고기를 지우고 값만큼 동전을 준다(한 트랜잭션).
     */
    @Transactional
    public Sale sellFish(UUID member, UUID itemId) {
        if (!cartOpen()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Food cart is closed");
        var item = item(member, itemId).filter(found -> FISH.equals(found.kind()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fish not found"));
        int price = fishPrice(item.name(), item.sizeCm());
        if (price <= 0 || store.remove(member, itemId) != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fish not found");
        store.changeCoins(member, price, FISH_SALE).orElseThrow();
        return new Sale(price, view(member));
    }

    /** 이 회원 가방에 이 아이템이 있는지 */
    public boolean owns(UUID member, UUID itemId) { return store.owned(member).stream().anyMatch(item -> item.id().equals(itemId)); }

    /** 이 회원 가방의 아이템(교환 신청 화면에 보여 줄 값) */
    public Optional<InventoryStore.Item> item(UUID member, UUID itemId) {
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

    /** 바닥 아이템을 화면에 필요한 값만으로 */
    public record GroundItem(String id, String kind, String name, Integer sizeCm, double x, double y) {}
    /** 줍기 거리(px). 클라이언트가 알려 준 내 위치에서 이 거리 안의 아이템만 주울 수 있다. */
    public static final double PICK_RANGE = 48;

    public List<GroundItem> groundView(String roomId) {
        return store.ground(roomId).stream().map(item -> new GroundItem(item.id().toString(), item.kind(), item.name(), item.sizeCm(), item.x(), item.y())).toList();
    }

    /** 내 위치(x, y) 근처의 바닥 아이템을 줍는다. 멀거나 이미 누가 주웠으면 빈 값 */
    @Transactional
    public Optional<InventoryStore.Item> pickNear(UUID member, UUID itemId, String roomId, double x, double y) {
        boolean near = store.ground(roomId).stream().anyMatch(item -> item.id().equals(itemId) && Math.hypot(item.x() - x, item.y() - y) <= PICK_RANGE);
        return near ? pick(member, itemId, roomId) : Optional.empty();
    }
}
