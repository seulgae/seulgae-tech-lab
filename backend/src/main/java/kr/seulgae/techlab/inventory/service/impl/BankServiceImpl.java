package kr.seulgae.techlab.inventory.service.impl;

import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.service.*;
import kr.seulgae.techlab.inventory.repository.*;
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
public class BankServiceImpl implements BankService {


    private final InventoryRepository store;

    public BankServiceImpl(InventoryRepository store) { this.store = store; }

    public BankViewDTO view(UUID member) {
        return new BankViewDTO(store.coins(member), Math.max(0, DAILY_TRANSFERS - store.countToday(member, TRANSFER_OUT)), store.history(member, HISTORY_LIMIT));
    }

    /** 닉네임으로 받을 사람을 찾는다(1~20자, 나는 빠진다). */
    public List<RecipientDTO> search(UUID member, String query) {
        String text = query == null ? "" : query.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > QUERY_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "query must be 1-" + QUERY_MAX + " characters");
        return store.recipients(text, member, SEARCH_LIMIT);
    }

    /**
     * 송금. 금액이 1~100원이 아니거나 나에게 보내면 400, 받는 사람이 없으면 404,
     * 오늘 10번 보냈으면 429, 잔액이 모자라면 409(아무것도 바꾸지 않음).
     */
    @Transactional
    public BankViewDTO transfer(UUID from, UUID to, Integer amount) {
        if (amount == null || amount < TRANSFER_MIN || amount > TRANSFER_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be " + TRANSFER_MIN + "-" + TRANSFER_MAX);
        if (to == null || to.equals(from)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recipient");
        if (store.nickname(to).isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found");
        if (store.countToday(from, TRANSFER_OUT) >= DAILY_TRANSFERS) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily transfer limit");
        store.changeCoins(from, -amount, TRANSFER_OUT, to).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        store.changeCoins(to, amount, TRANSFER_IN, from).orElseThrow();
        return view(from);
    }
}
