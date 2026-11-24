package kr.seulgae.techlab.gamble.service.impl;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import kr.seulgae.techlab.gamble.dto.GambleResultDTO;
import kr.seulgae.techlab.gamble.service.GambleService;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 오락실 내기 게임 구현. 난수는 서버의 SecureRandom이 만든다(화면은 결과를 연출만 한다).
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 */
@Service
public class GambleServiceImpl implements GambleService {
    /** 사다리 가로줄 행 수 */
    static final int LADDER_ROWS = 6;
    private final InventoryRepository inventory;
    private final Random random;

    @Autowired
    public GambleServiceImpl(InventoryRepository inventory) { this(inventory, new SecureRandom()); }

    public GambleServiceImpl(InventoryRepository inventory, Random random) { this.inventory = inventory; this.random = random; }

    /** 게임 결과(연출 값, 당첨금) */
    record Outcome(List<Integer> numbers, int payout) {}

    @Override
    public int betsLeft(UUID member) { return Math.max(0, DAILY_BETS - inventory.countToday(member, BET)); }

    @Override
    @Transactional
    public GambleResultDTO play(UUID member, String game, Integer bet, String pick) {
        if (bet == null || bet < MIN_BET || bet > MAX_BET) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bet must be " + MIN_BET + "-" + MAX_BET);
        String normalized = validPick(game, pick);
        if (betsLeft(member) <= 0) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily bet limit");
        /* 건 돈부터 뺀다: 모자라면 판을 열지 않는다. */
        int coins = inventory.changeCoins(member, -bet, BET).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        Outcome outcome = roll(game, bet, normalized, random);
        if (outcome.payout() > 0) coins = inventory.changeCoins(member, outcome.payout(), WIN).orElseThrow();
        return new GambleResultDTO(game, normalized, bet, outcome.numbers(), outcome.payout() > bet, outcome.payout(), coins, betsLeft(member));
    }

    /**
     * 게임과 고른 값을 확인한다.
     *
     * @param game 게임
     * @param pick 고른 값
     * @return 다듬은 고른 값(슬롯은 빈 문자열)
     */
    static String validPick(String game, String pick) {
        String value = pick == null ? "" : pick.strip().toUpperCase();
        boolean ok = switch (game == null ? "" : game) {
            case "ODD_EVEN" -> Set.of("ODD", "EVEN").contains(value);
            case "LADDER" -> Set.of("0", "1", "2").contains(value);
            case "DICE" -> Set.of("1", "2", "3", "4", "5", "6").contains(value);
            case "SLOT" -> { value = ""; yield true; }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown game");
        };
        if (!ok) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pick");
        return value;
    }

    /**
     * 결과를 정한다.
     *
     * @param game 게임
     * @param bet 건 동전
     * @param pick 고른 값
     * @param random 난수
     * @return 연출 값과 당첨금
     */
    static Outcome roll(String game, int bet, String pick, Random random) {
        return switch (game) {
            case "ODD_EVEN" -> {
                int a = random.nextInt(6) + 1, b = random.nextInt(6) + 1;
                boolean even = (a + b) % 2 == 0;
                yield new Outcome(List.of(a, b), even == pick.equals("EVEN") ? bet * 19 / 10 : 0);
            }
            case "LADDER" -> {
                int prize = random.nextInt(3);
                List<Integer> numbers = new ArrayList<>(List.of(prize));
                int lane = Integer.parseInt(pick);
                for (int row = 0; row < LADDER_ROWS; row++) {
                    int rung = random.nextInt(3) - 1;
                    numbers.add(rung);
                    lane = follow(lane, rung);
                }
                numbers.add(lane);
                yield new Outcome(numbers, lane == prize ? bet * 28 / 10 : 0);
            }
            case "DICE" -> {
                int face = random.nextInt(6) + 1;
                yield new Outcome(List.of(face), String.valueOf(face).equals(pick) ? bet * 55 / 10 : 0);
            }
            default -> {
                int a = random.nextInt(5), b = random.nextInt(5), c = random.nextInt(5);
                int payout = a == b && b == c ? bet * (a == 0 ? 50 : 10) : a == b || b == c || a == c ? bet / 2 : 0;
                yield new Outcome(List.of(a, b, c), payout);
            }
        };
    }

    /**
     * 사다리 한 행을 지난다: 가로줄 0은 0·1번 줄, 1은 1·2번 줄을 잇는다.
     *
     * @param lane 지금 줄
     * @param rung 가로줄(-1이면 없음)
     * @return 다음 줄
     */
    static int follow(int lane, int rung) {
        if (rung == 0 && lane <= 1) return 1 - lane;
        if (rung == 1 && lane >= 1) return 3 - lane;
        return lane;
    }
}
