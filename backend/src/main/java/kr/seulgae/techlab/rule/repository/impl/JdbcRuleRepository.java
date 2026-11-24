package kr.seulgae.techlab.rule.repository.impl;

import java.util.List;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.GameValue;
import kr.seulgae.techlab.rule.entity.Snack;
import kr.seulgae.techlab.rule.repository.RuleRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * PostgreSQL 게임 규칙 저장소(tb_lab_action_cost, tb_lab_snack, tb_lab_rank, tb_lab_game_rule).
 *
 * @author 길태형
 * @version 1.1, 숫자 규칙(tb_lab_game_rule)
 * @see None
 */
@Repository
public class JdbcRuleRepository implements RuleRepository {
    private final JdbcClient jdbc;

    public JdbcRuleRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public List<ActionCost> actionCosts() {
        return jdbc.sql("SELECT code, name, hp_cost, fatigue_cost, description FROM lab.tb_lab_action_cost ORDER BY sort_order, code")
            .query((rs, row) -> new ActionCost(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getString(5))).list();
    }

    @Override public List<Snack> snacks() {
        return jdbc.sql("SELECT code, name, price, hp_gain, fatigue_gain, place FROM lab.tb_lab_snack ORDER BY sort_order, code")
            .query((rs, row) -> new Snack(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getInt(5), rs.getString(6))).list();
    }

    @Override public List<Rank> ranks() {
        return jdbc.sql("SELECT code, name, min_work, salary, vitals_max, unlimited FROM lab.tb_lab_rank ORDER BY min_work")
            .query((rs, row) -> new Rank(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getInt(5), rs.getBoolean(6))).list();
    }

    @Override public List<GameValue> values() {
        return jdbc.sql("SELECT code, name, value, description FROM lab.tb_lab_game_rule ORDER BY sort_order, code")
            .query((rs, row) -> new GameValue(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4))).list();
    }
}
