package kr.seulgae.techlab.inventory;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 인벤토리 저장소(V5 lab.tb_lab_member_inventory, lab.tb_lab_coin_history, lab.tb_lab_item). 운영은 PostgreSQL, 로컬·테스트는 메모리 구현을 쓴다.
 *
 * @author seulgae
 * @version 1.1, 구매 시 회복 상태 잠금
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
    /** 구매 트랜잭션이 끝날 때까지 회복 상태를 잠근다. 메모리 구현은 단일 테스트용이다.
     * @param member 구매 회원
     * @return 잠금 후 최신 회복 상태
     */
    default Vitals lockVitals(UUID member) { return vitals(member); }
    /**
     * HP·피로도를 더하거나 뺀다. 더할 때는 최대치에서 멈추고, 빼서 0보다 작아지면 빈 값을 돌려준다(아무것도 바꾸지 않음).
     */
    Optional<Vitals> changeVitals(UUID member, int hp, int fatigue);
    /** 동전을 더하거나 뺀다. 잔액이 음수가 되면 빈 값을 돌려준다(아무것도 바꾸지 않음). */
    default Optional<Integer> changeCoins(UUID member, int amount, String reason) { return changeCoins(member, amount, reason, null); }
    /** 동전을 더하거나 뺀다. 송금이면 상대 회원(counterpart)을 함께 남긴다(V11). */
    Optional<Integer> changeCoins(UUID member, int amount, String reason, UUID counterpart);

    /** 은행 거래 내역 한 줄: 변동, 사유 코드와 이름, 송금 상대 닉네임(없으면 null) */
    record CoinEvent(UUID id, int amount, String reason, String reasonName, String counterpart, OffsetDateTime createdAt) {}
    /** 송금 받을 사람 */
    record Recipient(UUID id, String nickname) {}
    /** 최근 동전 변동(최근순) */
    List<CoinEvent> history(UUID member, int limit);
    /** 닉네임에 이 글자가 들어간 회원(나는 빼고, 최근 로그인순) */
    List<Recipient> recipients(String query, UUID exclude, int limit);
    /** 회원 닉네임(없는 회원이면 빈 값) */
    Optional<String> nickname(UUID member);
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
    /** 내 가방의 아이템을 없앤다(판매). @return 지운 행 수(내 것이 아니면 0) */
    int remove(UUID member, UUID itemId);
    /** 이 방 바닥의 아이템을 줍는다. 이미 누가 주웠으면 빈 값(동시에 주워도 한 명만 성공) */
    Optional<Item> pick(UUID member, UUID itemId, String roomId);
}
