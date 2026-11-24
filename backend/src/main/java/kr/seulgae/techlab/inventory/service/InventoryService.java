package kr.seulgae.techlab.inventory.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.entity.*;

/**
 * InventoryService 기능 명세(구현: InventoryServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface InventoryService {
    String FISH = "FISH", WORK_POST = "WORK_POST", ARCADE_PLAY = "ARCADE_PLAY";
    int WORK_POST_REWARD = 10, DAILY_REWARD_LIMIT = 10, ARCADE_COST = 1, MAX_ITEMS = 40, MAX_GROUND_ITEMS = 30;
    /** 일·오락 한 번에 드는 HP와 스태미나 */
    int WORK_HP_COST = 3, WORK_FATIGUE_COST = 5;
    /** 간식: 공통코드 COIN_REASON(CAKE, COFFEE), 가격과 회복량 */
    String CAKE = "CAKE", COFFEE = "COFFEE";
    int CAKE_PRICE = 3, CAKE_HP = 10, COFFEE_PRICE = 2, COFFEE_FATIGUE = 5;
    /** 식물 행운: 화분을 흔들면 5% 확률로 1~3원. 하루 10번까지만 당첨되고, 2초 안에 다시 흔들면 추첨하지 않는다(연타 방지). */
    String PLANT_LUCK = "PLANT_LUCK";
    double PLANT_LUCK_CHANCE = 0.05;
    int PLANT_LUCK_MIN = 1, PLANT_LUCK_MAX = 3, PLANT_DAILY_WINS = 10;
    long PLANT_COOLDOWN_MS = 2000;
    /** 포장마차 물고기 판매: 저녁(한국 시간 18시~자정)에만 연다. 한 마리 최대 30원 */
    String FISH_SALE = "FISH_SALE";
    int FISH_PRICE_MAX = 30, CART_OPEN_HOUR = 18;
    /** HP·스태미나가 모자라 일·오락을 할 수 없음(423 Locked) */
    HttpStatus TIRED = HttpStatus.LOCKED;
    /** 이미 가득 차서 간식을 사지 않음(422) */
    HttpStatus ALREADY_FULL = HttpStatus.UNPROCESSABLE_CONTENT;
    /** 줍기 거리(px). 클라이언트가 알려 준 내 위치에서 이 거리 안의 아이템만 주울 수 있다. */
    double PICK_RANGE = 48;

    /**
     * 화분을 흔든다. 추첨은 서버가 한다(화면이 결과를 정하지 못하게).
     * 2초 안에 다시 흔들면 추첨하지 않고, 오늘 10번 당첨됐으면 더 주지 않는다.
     */
    PlantResultDTO shakePlant(UUID member);

    InventoryViewDTO view(UUID member);

    /** 낚은 물고기를 가방에 넣는다. 어종·크기를 확인하고 가방이 꽉 차면 거절한다. */
    Item storeFish(UUID member, String species, Integer cm);

    /** 사무실 게시물 보상. 하루 한도를 넘으면 0원이다. @return 실제로 받은 동전 */
    int rewardWorkPost(UUID member);

    /** 오락실 한 판. HP·스태미나가 모자라면 423, 동전이 없으면 409(둘 다 아무것도 바꾸지 않음). @return 남은 동전 */
    int playArcade(UUID member);

    /** 일·오락을 할 수 있을 만큼 HP·스태미나가 남았는지 확인한다. 모자라면 423. */
    void ensureFit(UUID member);

    /** 사무실 게시판에서 일한 뒤 HP -3, 스태미나 -5(모자라면 빼지 않는다). */
    void spendWork(UUID member);

    /**
     * 로비 간식·음료를 서버 가격으로 구매한다. 탄산음료 2원 스태미나 +5, 물 1원 스태미나 +2.
     * 케이크 3원 HP +10, 커피 2원 스태미나 +5이며 회복은 최대치에서 멈춘다.
     * 이미 가득이면 422(돈을 받지 않음), 동전이 모자라면 409.
     * @param member 구매 회원
     * @param kind 서버가 허용한 간식·음료 코드
     * @return 구매 후 잔액과 회복 상태
     */
    InventoryViewDTO buySnack(UUID member, String kind);

    /** 내 아이템을 지금 서 있는 곳 바닥에 내려놓는다. 바닥이 너무 어질러졌으면 거절한다. */
    Optional<Item> drop(UUID member, UUID itemId, String roomId, double x, double y);

    Optional<Item> pick(UUID member, UUID itemId, String roomId);

    List<Item> ground(String roomId);

    /** 포장마차가 열려 있는지(한국 시간 18시~자정) */
    boolean cartOpen();

    /**
     * 포장마차에 물고기를 판다. 저녁이 아니면 409(closed), 내 물고기가 아니면 404. 물고기를 지우고 값만큼 동전을 준다(한 트랜잭션).
     */
    SaleDTO sellFish(UUID member, UUID itemId);

    /** 이 회원 가방에 이 아이템이 있는지 */
    boolean owns(UUID member, UUID itemId);

    /** 이 회원 가방의 아이템(교환 신청 화면에 보여 줄 값) */
    Optional<Item> item(UUID member, UUID itemId);

    /**
     * 회의실 교환: a의 itemA와 b의 itemB를 맞바꾼다. 둘 중 하나라도 이미 주인이 바뀌었으면 409(아무것도 바꾸지 않음).
     */
    void trade(UUID a, UUID itemA, UUID b, UUID itemB);

    List<GroundItemDTO> groundView(String roomId);

    /** 내 위치(x, y) 근처의 바닥 아이템을 줍는다. 멀거나 이미 누가 주웠으면 빈 값 */
    Optional<Item> pickNear(UUID member, UUID itemId, String roomId, double x, double y);
}
