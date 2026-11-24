package kr.seulgae.techlab.gamble.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Random;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import org.junit.jupiter.api.Test;

/**
 * 오락실 내기: 입력 확인, 동전 이동, 사다리 길 따라가기, 게임마다 기대값이 1보다 작음(오락실이 이긴다).
 *
 * @author 길태형
 * @version 1.0, 오락실 내기 게임
 * @see None
 */
class GambleServiceTest {
    private final InMemoryInventoryRepository inventory = new InMemoryInventoryRepository();
    private final UUID me = UUID.randomUUID();

    @Test
    void validatesInputAndMovesCoins() {
        var service = new GambleServiceImpl(inventory, new Random(3));
        inventory.changeCoins(me, 10, "TEST");
        assertThatThrownBy(() -> service.play(me, "POKER", 1, "")).hasMessageContaining("400");
        assertThatThrownBy(() -> service.play(me, "ODD_EVEN", 21, "ODD")).hasMessageContaining("400");
        assertThatThrownBy(() -> service.play(me, "DICE", 1, "7")).hasMessageContaining("400");
        assertThatThrownBy(() -> service.play(me, "LADDER", 1, "3")).hasMessageContaining("400");
        var result = service.play(me, "DICE", 10, "3");
        assertThat(result.coins()).isEqualTo(result.payout());
        assertThat(result.betsLeftToday()).isEqualTo(4);
        assertThat(inventory.coins(me)).isEqualTo(result.payout());
    }

    @Test
    void ladderFollowsRungs() {
        assertThat(GambleServiceImpl.follow(0, 0)).isEqualTo(1);
        assertThat(GambleServiceImpl.follow(1, 0)).isEqualTo(0);
        assertThat(GambleServiceImpl.follow(2, 0)).isEqualTo(2);
        assertThat(GambleServiceImpl.follow(1, 1)).isEqualTo(2);
        assertThat(GambleServiceImpl.follow(2, 1)).isEqualTo(1);
        assertThat(GambleServiceImpl.follow(0, -1)).isEqualTo(0);
        var outcome = GambleServiceImpl.roll("LADDER", 10, "0", new Random(5));
        assertThat(outcome.numbers()).hasSize(GambleServiceImpl.LADDER_ROWS + 2);
        int lane = 0;
        for (int row = 1; row <= GambleServiceImpl.LADDER_ROWS; row++) lane = GambleServiceImpl.follow(lane, outcome.numbers().get(row));
        assertThat(outcome.numbers().get(GambleServiceImpl.LADDER_ROWS + 1)).isEqualTo(lane);
    }

    @Test
    void everyGameFavorsTheHouse() {
        var random = new Random(11);
        String[][] games = { { "ODD_EVEN", "ODD" }, { "LADDER", "1" }, { "DICE", "4" }, { "SLOT", "" } };
        for (String[] game : games) {
            long paid = 0;
            int rounds = 200_000;
            for (int i = 0; i < rounds; i++) paid += GambleServiceImpl.roll(game[0], 10, game[1], random).payout();
            double expected = paid / (10.0 * rounds);
            assertThat(expected).as(game[0]).isBetween(0.85, 0.99);
        }
    }
}
