package kr.seulgae.techlab.inventory;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 폰 은행 앱: 잔액과 거래 내역, 다른 연구원에게 송금.
 * 한 번에 1~100원, 하루 10번까지 보낼 수 있다. 보낸 쪽(TRANSFER_OUT)과 받은 쪽(TRANSFER_IN) 기록을 한 트랜잭션으로 남긴다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(은행)
 * @see "None"
 */
@Service
public class BankService {
    /** 공통코드 COIN_REASON(V11) */
    public static final String TRANSFER_OUT = "TRANSFER_OUT", TRANSFER_IN = "TRANSFER_IN";
    public static final int TRANSFER_MIN = 1, TRANSFER_MAX = 100, DAILY_TRANSFERS = 10, HISTORY_LIMIT = 30, SEARCH_LIMIT = 10, QUERY_MAX = 20;

    /** 은행 화면: 잔액, 오늘 남은 송금 횟수, 최근 거래 */
    public record View(int coins, int transfersLeftToday, List<InventoryStore.CoinEvent> history) {}

    private final InventoryStore store;

    public BankService(InventoryStore store) { this.store = store; }

    public View view(UUID member) {
        return new View(store.coins(member), Math.max(0, DAILY_TRANSFERS - store.countToday(member, TRANSFER_OUT)), store.history(member, HISTORY_LIMIT));
    }

    /** 닉네임으로 받을 사람을 찾는다(1~20자, 나는 빠진다). */
    public List<InventoryStore.Recipient> search(UUID member, String query) {
        String text = query == null ? "" : query.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > QUERY_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "query must be 1-" + QUERY_MAX + " characters");
        return store.recipients(text, member, SEARCH_LIMIT);
    }

    /**
     * 송금. 금액이 1~100원이 아니거나 나에게 보내면 400, 받는 사람이 없으면 404,
     * 오늘 10번 보냈으면 429, 잔액이 모자라면 409(아무것도 바꾸지 않음).
     */
    @Transactional
    public View transfer(UUID from, UUID to, Integer amount) {
        if (amount == null || amount < TRANSFER_MIN || amount > TRANSFER_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be " + TRANSFER_MIN + "-" + TRANSFER_MAX);
        if (to == null || to.equals(from)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recipient");
        if (store.nickname(to).isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found");
        if (store.countToday(from, TRANSFER_OUT) >= DAILY_TRANSFERS) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily transfer limit");
        store.changeCoins(from, -amount, TRANSFER_OUT, to).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        store.changeCoins(to, amount, TRANSFER_IN, from).orElseThrow();
        return view(from);
    }
}
