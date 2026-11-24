package kr.seulgae.techlab.gamble.service;

import java.util.UUID;
import kr.seulgae.techlab.gamble.dto.GambleResultDTO;

/**
 * 오락실 내기 게임 명세(구현: GambleServiceImpl). 게임 동전만 걸고, 결과는 서버가 정한다.
 * 모든 게임은 기대값이 건 돈보다 조금 작다(오락실이 이긴다).
 * <ul>
 *   <li>ODD_EVEN 홀짝: 주사위 두 개 합의 홀짝을 맞히면 1.9배</li>
 *   <li>LADDER 사다리: 세 줄 중 하나를 골라 당첨 칸에 내려가면 2.8배</li>
 *   <li>DICE 주사위: 눈 하나를 맞히면 5.5배</li>
 *   <li>SLOT 슬롯머신: 7 세 개 50배, 같은 그림 세 개 10배, 두 개는 건 돈의 절반</li>
 * </ul>
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 */
public interface GambleService {
    int MIN_BET = 1, MAX_BET = 20, DAILY_BETS = 10;
    /** 공통코드 COIN_REASON */
    String BET = "GAMBLE_BET", WIN = "GAMBLE_WIN";

    /**
     * 한 판 한다: 건 돈을 빼고, 결과를 정하고, 이기면 당첨금을 넣는다(한 트랜잭션).
     *
     * @param member 회원 ID
     * @param game 게임
     * @param bet 건 동전
     * @param pick 고른 값
     * @return 결과
     * @exception org.springframework.web.server.ResponseStatusException 게임·금액·고른 값이 틀리면 400, 동전 부족 409, 하루 횟수 429
     */
    GambleResultDTO play(UUID member, String game, Integer bet, String pick);

    /**
     * 오늘 남은 판 수.
     *
     * @param member 회원 ID
     * @return 남은 횟수
     */
    int betsLeft(UUID member);
}
