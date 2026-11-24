package kr.seulgae.techlab.savings.service.impl;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.savings.dto.SavingsTermDTO;
import kr.seulgae.techlab.savings.dto.SavingsViewDTO;
import kr.seulgae.techlab.savings.entity.Savings;
import kr.seulgae.techlab.savings.repository.SavingsRepository;
import kr.seulgae.techlab.savings.service.SavingsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 적금 규칙 구현. 동전 이동과 적금 행 변경을 한 트랜잭션에서 한다.
 * 찾기는 "진행 중일 때만 닫기"가 성공한 경우에만 동전을 돌려줘, 두 번 눌러도 한 번만 받는다.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see "None"
 */
@Service
public class SavingsServiceImpl implements SavingsService {
    private final SavingsRepository savings;
    private final InventoryRepository inventory;
    private final Clock clock;

    @Autowired
    public SavingsServiceImpl(SavingsRepository savings, InventoryRepository inventory) { this(savings, inventory, Clock.systemDefaultZone()); }

    public SavingsServiceImpl(SavingsRepository savings, InventoryRepository inventory, Clock clock) {
        this.savings = savings; this.inventory = inventory; this.clock = clock;
    }

    @Override
    public SavingsViewDTO view(UUID member) {
        var terms = TERMS.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(entry -> new SavingsTermDTO(entry.getKey(), entry.getValue())).toList();
        return new SavingsViewDTO(inventory.coins(member), terms, savings.list(member, CLOSED_SHOWN), MAX_AMOUNT, MAX_OPEN);
    }

    @Override
    @Transactional
    public SavingsViewDTO deposit(UUID member, Integer amount, Integer days) {
        if (amount == null || amount < MIN_AMOUNT || amount > MAX_AMOUNT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be " + MIN_AMOUNT + "-" + MAX_AMOUNT);
        Integer rate = days == null ? null : TERMS.get(days);
        if (rate == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown term");
        if (savings.openCount(member) >= MAX_OPEN) throw new ResponseStatusException(HttpStatus.CONFLICT, "Too many savings");
        /* 동전부터 뺀다: 모자라면 적금을 만들지 않는다. */
        inventory.changeCoins(member, -amount, DEPOSIT).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        OffsetDateTime now = OffsetDateTime.now(clock);
        savings.create(member, amount, days, rate, now, now.plusDays(days));
        return view(member);
    }

    @Override
    @Transactional
    public SavingsViewDTO withdraw(UUID member, UUID id) {
        Savings item = savings.find(member, id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Savings not found"));
        OffsetDateTime now = OffsetDateTime.now(clock);
        int payout = payout(item, now);
        /* 진행 중일 때만 닫히므로, 동시에 두 번 찾아도 동전은 한 번만 들어간다. */
        if (!savings.close(member, id, payout, now)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Already withdrawn");
        inventory.changeCoins(member, payout, PAYOUT).orElseThrow();
        return view(member);
    }

    /**
     * 지금 찾으면 받을 동전: 만기가 지났으면 원금 + 원금×이자율(내림), 아니면 원금.
     *
     * @param item 적금
     * @param now 지금
     * @return 받을 동전
     */
    public static int payout(Savings item, OffsetDateTime now) {
        boolean matured = !now.isBefore(item.maturesAt());
        return matured ? item.principal() + item.principal() * item.ratePct() / 100 : item.principal();
    }
}
