package kr.seulgae.techlab.rule.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.inventory.service.impl.InventoryServiceImpl;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.Snack;
import kr.seulgae.techlab.rule.repository.RuleRepository;
import org.junit.jupiter.api.Test;

/**
 * 게임 규칙 테이블: 1분 캐시와 다시 읽기, 읽기 실패·잘못된 직급표면 이전 값 유지, 서비스가 테이블 값(비용·간식)을 쓰는지.
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see None
 */
class GameRulesTest {
    /** 운영자가 테이블을 고친 것처럼 값을 바꿀 수 있는 저장소 */
    static final class Editable implements RuleRepository {
        List<ActionCost> actions = new ArrayList<>(GameRules.DEFAULT_ACTIONS);
        List<Snack> snacks = new ArrayList<>(GameRules.DEFAULT_SNACKS);
        List<Rank> ranks = new ArrayList<>(Rank.DEFAULTS);
        boolean broken;
        @Override public List<ActionCost> actionCosts() { if (broken) throw new IllegalStateException("db down"); return actions; }
        @Override public List<Snack> snacks() { return snacks; }
        @Override public List<Rank> ranks() { return ranks; }
    }

    private final Editable table = new Editable();
    private final long[] now = { 0 };
    private final GameRules rules = new GameRules(table, () -> now[0]);
    private final UUID me = UUID.randomUUID();

    @Test
    void cachesForOneMinuteThenRereads() {
        assertThat(rules.action(ActionCost.ARCADE_PLAY).fatigueCost()).isEqualTo(5);
        table.actions = List.of(new ActionCost(ActionCost.ARCADE_PLAY, "오락실 한 판", 1, 2, ""));
        now[0] = GameRules.REFRESH_MS - 1;
        assertThat(rules.action(ActionCost.ARCADE_PLAY).fatigueCost()).isEqualTo(5);
        now[0] = GameRules.REFRESH_MS;
        assertThat(rules.action(ActionCost.ARCADE_PLAY).fatigueCost()).isEqualTo(2);
        assertThat(rules.action("UNKNOWN").hpCost()).isZero();
    }

    @Test
    void keepsPreviousValuesWhenTablesAreBrokenOrRankStartsAboveZero() {
        rules.rules();
        table.broken = true;
        now[0] = GameRules.REFRESH_MS;
        assertThat(rules.action(ActionCost.QA_MOVE).hpCost()).isEqualTo(3);
        table.broken = false;
        table.ranks = List.of(new Rank("X", "엑스", 1, 1, 50, false));
        now[0] = GameRules.REFRESH_MS * 2;
        assertThat(rules.rankOf(0).name()).isEqualTo("인턴");
    }

    @Test
    void servicesUseTableValues() {
        var inventory = new InMemoryInventoryRepository();
        var service = new InventoryServiceImpl(inventory, rules);
        inventory.changeCoins(me, 10, "TEST");
        /* 운영자가 커피 회복량을 3으로, 오락실 비용을 HP 0·기력 10으로 바꿨다 */
        table.snacks = List.of(new Snack("COFFEE", "커피", 4, 0, 3, "LOBBY"));
        table.actions = List.of(new ActionCost(ActionCost.ARCADE_PLAY, "오락실 한 판", 0, 10, ""));
        rules.invalidate();
        service.playArcade(me);
        assertThat(inventory.vitals(me).hp()).isEqualTo(50);
        assertThat(inventory.vitals(me).fatigue()).isEqualTo(40);
        var after = service.buySnack(me, "COFFEE");
        assertThat(after.fatigue()).isEqualTo(43);
        assertThat(after.coins()).isEqualTo(10 - 1 - 4);
        assertThatThrownBy(() -> service.buySnack(me, "CAKE")).hasMessageContaining("400");
    }
}
