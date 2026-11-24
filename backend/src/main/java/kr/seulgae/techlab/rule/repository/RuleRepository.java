package kr.seulgae.techlab.rule.repository;

import java.util.List;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.Snack;

/**
 * 게임 규칙 테이블 읽기 명세(구현: JdbcRuleRepository, 기본값: DefaultRules).
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see None
 */
public interface RuleRepository {
    /** @return 행동별 비용(표시 순서) */
    List<ActionCost> actionCosts();

    /** @return 간식·음료(표시 순서) */
    List<Snack> snacks();

    /** @return 직급(낮은 직급부터) */
    List<Rank> ranks();
}
