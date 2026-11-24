package kr.seulgae.techlab.rule.entity;

/**
 * 행동별 HP·기력 비용(tb_lab_action_cost).
 *
 * @author 길태형
 * @version 1.1, 내기·낚시·자바 연습·주식·가구 배치 비용
 * @see "None"
 */
public record ActionCost(String code, String name, int hpCost, int fatigueCost, String description) {
    /** 아이디어 글·QA 등록·QA 단계 변경·오락실 한 판 */
    public static final String IDEA_POST = "IDEA_POST", QA_REGISTER = "QA_REGISTER", QA_MOVE = "QA_MOVE", ARCADE_PLAY = "ARCADE_PLAY";
    /** 내기 한 판·물고기 낚기·자바 연습 답 제출·주식 거래·가구 배치(V24) */
    public static final String GAMBLE_BET = "GAMBLE_BET", FISH_CATCH = "FISH_CATCH", JAVA_ANSWER = "JAVA_ANSWER",
        STOCK_TRADE = "STOCK_TRADE", FURNITURE_PLACE = "FURNITURE_PLACE";
}
