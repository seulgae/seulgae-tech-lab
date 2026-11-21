package kr.seulgae.techlab.inventory;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 인벤토리 저장소(V5 lab.inventories, lab.coin_events, lab.items). 운영은 PostgreSQL, 로컬·테스트는 메모리 구현을 쓴다.
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
public interface InventoryStore {
    /**
     * 아이템. 주인이 있으면 인벤토리에 있고(roomId·x·y는 null), 주인이 없으면 방 바닥에 놓여 있다.
     * @param kind 공통코드 ITEM_KIND(FISH)
     */
    record Item(UUID id, String kind, String name, Integer sizeCm, String roomId, Double x, Double y, OffsetDateTime createdAt) {}

    /** HP·피로도(일지 #10). 피로도는 남은 기력처럼 높을수록 좋다. 최대치는 회원별(기본 50). */
    record Vitals(int hp, int hpMax, int fatigue, int fatigueMax) {}

    int coins(UUID member);
    Vitals vitals(UUID member);
    /**
     * HP·피로도를 더하거나 뺀다. 더할 때는 최대치에서 멈추고, 빼서 0보다 작아지면 빈 값을 돌려준다(아무것도 바꾸지 않음).
     */
    Optional<Vitals> changeVitals(UUID member, int hp, int fatigue);
    /** 동전을 더하거나 뺀다. 잔액이 음수가 되면 빈 값을 돌려준다(아무것도 바꾸지 않음). */
    Optional<Integer> changeCoins(UUID member, int amount, String reason);
    /** 오늘(한국 시간) 이 사유로 동전이 바뀐 횟수 */
    int countToday(UUID member, String reason);
    List<Item> owned(UUID member);
    Item add(UUID member, String kind, String name, Integer sizeCm);
    /** 내 아이템을 방 바닥에 내려놓는다. 내 것이 아니면 빈 값 */
    Optional<Item> drop(UUID member, UUID itemId, String roomId, double x, double y);
    List<Item> ground(String roomId);
    /**
     * 두 회원의 가방 아이템을 맞바꾼다(a의 itemA ↔ b의 itemB).
     * @return 바뀐 행 수. 2가 아니면 호출한 쪽이 되돌려야 한다(트랜잭션).
     */
    int swap(UUID a, UUID itemA, UUID b, UUID itemB);
    /** 이 방 바닥의 아이템을 줍는다. 이미 누가 주웠으면 빈 값(동시에 주워도 한 명만 성공) */
    Optional<Item> pick(UUID member, UUID itemId, String roomId);
}
