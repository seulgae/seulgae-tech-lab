package kr.seulgae.techlab.inventory.repository;

import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.entity.*;
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
public interface InventoryRepository {


    int coins(UUID member);
    Vitals vitals(UUID member);
    /** 구매 트랜잭션이 끝날 때까지 회복 상태를 잠근다. 메모리 구현은 단일 테스트용이다.
     * @param member 구매 회원
     * @return 잠금 후 최신 회복 상태
     */
    default Vitals lockVitals(UUID member) { return vitals(member); }
    /**
     * HP·기력을 더하거나 뺀다. 더할 때는 최대치에서 멈추고, 빼서 0보다 작아지면 빈 값을 돌려준다(아무것도 바꾸지 않음).
     */
    Optional<Vitals> changeVitals(UUID member, int hp, int fatigue);
    /** 동전을 더하거나 뺀다. 잔액이 음수가 되면 빈 값을 돌려준다(아무것도 바꾸지 않음). */
    default Optional<Integer> changeCoins(UUID member, int amount, String reason) { return changeCoins(member, amount, reason, null); }
    /** 동전을 더하거나 뺀다. 송금이면 상대 회원(counterpart)을 함께 남긴다(V11). */
    Optional<Integer> changeCoins(UUID member, int amount, String reason, UUID counterpart);

    /** 최근 동전 변동(최근순) */
    List<CoinHistory> history(UUID member, int limit);
    /** 닉네임에 이 글자가 들어간 회원(나는 빼고, 최근 로그인순) */
    List<RecipientDTO> recipients(String query, UUID exclude, int limit);
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

    /** 누적 일 완료 수(사원증 직급의 기준) */
    int workCount(UUID member);
    /** 누적 일 완료 수를 1 올린다. @return 올린 뒤의 값 */
    int addWork(UUID member);
    /** HP·기력 최대치를 둘 다 max로 바꾸고 가득 채운다(승진). */
    void raiseVitals(UUID member, int max);
    /** 마지막 급여 시각(받은 적 없으면 빈 값) */
    Optional<OffsetDateTime> lastSalaryAt(UUID member);
    /**
     * 급여 차례를 잡는다: 마지막 급여가 없거나 cutoff 이전이면 now로 바꾸고 true. 동시에 여러 번 불러도 한 번만 true다.
     */
    boolean claimSalary(UUID member, OffsetDateTime now, OffsetDateTime cutoff);
}
