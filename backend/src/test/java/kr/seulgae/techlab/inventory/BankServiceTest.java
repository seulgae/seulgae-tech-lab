package kr.seulgae.techlab.inventory;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 폰 은행: 송금은 1~100원, 하루 10번, 잔액 안에서. 두 사람 모두 거래 내역에 상대와 함께 남는다.
 * @author seulgae
 * @version 1.0, 폰 앱(은행)
 * @see "None"
 */
class BankServiceTest {
    private final InMemoryInventoryStore store = new InMemoryInventoryStore();
    private final BankService bank = new BankService(store);
    private final UUID me = UUID.randomUUID(), friend = UUID.randomUUID();

    private static int status(Runnable call) { return assertThrows(ResponseStatusException.class, call::run).getStatusCode().value(); }

    @Test void transferMovesCoinsAndBothSidesSeeIt() {
        store.addMember(me, "슬개");
        store.addMember(friend, "낚시왕");
        store.changeCoins(me, 50, InventoryService.WORK_POST);
        var view = bank.transfer(me, friend, 20);
        assertEquals(30, view.coins());
        assertEquals(20, store.coins(friend));
        assertEquals(BankService.DAILY_TRANSFERS - 1, view.transfersLeftToday());
        var sent = view.history().get(0);
        assertEquals(-20, sent.amount());
        assertEquals(BankService.TRANSFER_OUT, sent.reason());
        assertEquals("낚시왕", sent.counterpart());
        var received = bank.view(friend).history().get(0);
        assertEquals(20, received.amount());
        assertEquals("슬개", received.counterpart());
        assertEquals(1, bank.search(me, "낚시").size());
        assertEquals(0, bank.search(me, "슬개").size(), "나는 검색에서 빠진다");
    }

    @Test void transferRulesChangeNothingWhenRejected() {
        store.addMember(friend, "낚시왕");
        store.changeCoins(me, 5, InventoryService.WORK_POST);
        assertEquals(409, status(() -> bank.transfer(me, friend, 6)), "잔액 부족");
        assertEquals(400, status(() -> bank.transfer(me, friend, 0)));
        assertEquals(400, status(() -> bank.transfer(me, friend, 101)));
        assertEquals(400, status(() -> bank.transfer(me, me, 1)), "나에게는 못 보낸다");
        assertEquals(404, status(() -> bank.transfer(me, UUID.randomUUID(), 1)), "없는 회원");
        assertEquals(400, status(() -> bank.search(me, " ")));
        assertEquals(5, store.coins(me));
        assertEquals(0, store.coins(friend));
        store.changeCoins(me, 100, InventoryService.WORK_POST);
        for (int n = 0; n < BankService.DAILY_TRANSFERS; n++) bank.transfer(me, friend, 1);
        assertEquals(429, status(() -> bank.transfer(me, friend, 1)), "하루 10번");
    }
}
