package kr.seulgae.techlab.gamble.dto;

/**
 * 오락실 내기 요청: 게임, 건 동전, 고른 값(홀짝 ODD/EVEN, 사다리 0~2, 주사위 1~6, 슬롯은 없음).
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 */
public record GambleRequestDTO(String game, Integer bet, String pick) {}
