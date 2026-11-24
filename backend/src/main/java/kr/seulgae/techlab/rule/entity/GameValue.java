package kr.seulgae.techlab.rule.entity;

/**
 * 숫자 게임 규칙 하나(tb_lab_game_rule, 키 → 값).
 *
 * @author 길태형
 * @version 1.0, 숫자 규칙 테이블(V24)
 * @see None
 */
public record GameValue(String code, String name, int value, String description) {
    /** 침대 휴식: 회복 간격(초)·한 번 HP·한 번 기력 */
    public static final String REST_EVERY_SEC = "REST_EVERY_SEC", REST_HP = "REST_HP", REST_FATIGUE = "REST_FATIGUE";
}
