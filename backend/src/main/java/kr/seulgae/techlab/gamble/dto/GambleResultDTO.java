package kr.seulgae.techlab.gamble.dto;

import java.util.List;

/**
 * 오락실 내기 결과. numbers는 화면 연출용 값이다.
 * 홀짝: 주사위 두 개, 사다리: [당첨 칸, 가로줄(행마다 0=왼쪽 두 줄 연결, 1=오른쪽 두 줄 연결, -1=없음)…, 도착 칸],
 * 주사위: 나온 눈 하나, 슬롯: 릴 세 개(0이 7).
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 */
public record GambleResultDTO(String game, String pick, int bet, List<Integer> numbers, boolean win, int payout, int coins, int betsLeftToday) {}
