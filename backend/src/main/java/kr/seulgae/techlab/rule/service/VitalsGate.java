package kr.seulgae.techlab.rule.service;

import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.inventory.service.InventoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 행동 전 HP·기력 확인과 행동 뒤 차감(tb_lab_action_cost). 모자라면 423으로 막고, 연구소장(무제한 직급)은 보지도 빼지도 않는다.
 * 비용이 0·0인 행동은 아무것도 하지 않는다. 게시판·오락실·내기·낚시·자바 연습·주식·가구 배치가 같이 쓴다.
 *
 * @author 길태형
 * @version 1.0, HP·기력 행동 비용 확대
 * @see None
 */
@Component
public class VitalsGate {
    private final InventoryRepository store;
    private final GameRules rules;

    @Autowired
    public VitalsGate(InventoryRepository store, GameRules rules) { this.store = store; this.rules = rules; }

    /**
     * 기본 규칙으로 만든다(DB 없는 테스트용).
     *
     * @param store 소지품 저장소
     * @return 행동 비용 확인기
     */
    public static VitalsGate defaults(InventoryRepository store) { return new VitalsGate(store, GameRules.defaults()); }

    /**
     * 행동할 HP·기력이 있는지 본다.
     *
     * @param member 회원 ID
     * @param action 행동 코드
     * @exception ResponseStatusException 423(HP·기력 부족)
     */
    public void ensureFit(UUID member, String action) {
        var cost = rules.action(action);
        if ((cost.hpCost() == 0 && cost.fatigueCost() == 0) || unlimited(member)) return;
        var vitals = store.vitals(member);
        if (vitals.hp() < cost.hpCost() || vitals.fatigue() < cost.fatigueCost()) throw tired();
    }

    /**
     * 행동을 한 뒤 비용을 뺀다(같은 트랜잭션 안에서 부른다).
     *
     * @param member 회원 ID
     * @param action 행동 코드
     * @exception ResponseStatusException 423(그 사이 HP·기력이 모자라짐: 트랜잭션이 행동까지 되돌린다)
     */
    public void spend(UUID member, String action) {
        var cost = rules.action(action);
        if ((cost.hpCost() == 0 && cost.fatigueCost() == 0) || unlimited(member)) return;
        store.changeVitals(member, -cost.hpCost(), -cost.fatigueCost()).orElseThrow(VitalsGate::tired);
    }

    /** 연구소장은 HP·기력이 무제한이다. */
    private boolean unlimited(UUID member) { return rules.rankOf(store.workCount(member)).unlimited(); }

    private static ResponseStatusException tired() {
        return new ResponseStatusException(InventoryService.TIRED, "Too tired: rest in bed, eat or drink something");
    }
}
