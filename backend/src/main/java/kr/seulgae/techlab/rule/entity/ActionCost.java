package kr.seulgae.techlab.rule.entity;

/**
 * 행동별 HP·기력 비용(tb_lab_action_cost).
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see None
 */
public record ActionCost(String code, String name, int hpCost, int fatigueCost, String description) {
    /** 아이디어 글·QA 등록·QA 단계 변경·오락실 한 판 */
    public static final String IDEA_POST = "IDEA_POST", QA_REGISTER = "QA_REGISTER", QA_MOVE = "QA_MOVE", ARCADE_PLAY = "ARCADE_PLAY";
}
