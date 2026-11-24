package kr.seulgae.techlab.badge.service.impl;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import kr.seulgae.techlab.badge.dto.BadgeViewDTO;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.badge.service.BadgeService;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.rule.service.GameRules;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사원증·급여 구현. 급여는 "마지막 급여가 10분 전보다 오래됐을 때만 시각을 바꾸는" 조건부 UPDATE로 차례를 잡아,
 * 탭을 여러 개 열어도 10분에 한 번만 들어간다. 받은 급여는 동전 기록(SALARY)에도 남긴다.
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see "None"
 */
@Service
public class BadgeServiceImpl implements BadgeService {
    private final InventoryRepository inventory;
    private final Clock clock;

    private final GameRules rules;

    @Autowired
    public BadgeServiceImpl(InventoryRepository inventory, GameRules rules) { this(inventory, Clock.systemDefaultZone(), rules); }

    public BadgeServiceImpl(InventoryRepository inventory, Clock clock) { this(inventory, clock, GameRules.defaults()); }

    public BadgeServiceImpl(InventoryRepository inventory, Clock clock, GameRules rules) { this.inventory = inventory; this.clock = clock; this.rules = rules; }

    @Override
    public BadgeViewDTO view(UUID member) { return view(member, 0); }

    @Override
    @Transactional
    public BadgeViewDTO tick(UUID member) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        int paid = 0;
        if (inventory.claimSalary(member, now, now.minus(SALARY_EVERY))) {
            paid = rules.rankOf(inventory.workCount(member)).pay();
            inventory.changeCoins(member, paid, SALARY).orElseThrow();
        }
        return view(member, paid);
    }

    @Override
    @Transactional
    public Rank completeWork(UUID member) {
        Rank before = rules.rankOf(inventory.workCount(member));
        Rank after = rules.rankOf(inventory.addWork(member));
        if (after.code().equals(before.code())) return null;
        /* 승진: 최대치를 올리고 가득 채운다(승진 보너스) */
        inventory.raiseVitals(member, after.vitalsMax());
        return after;
    }

    /**
     * 화면 값을 만든다.
     *
     * @param member 회원 ID
     * @param paid 방금 받은 급여
     * @return 사원증
     */
    private BadgeViewDTO view(UUID member, int paid) {
        int work = inventory.workCount(member);
        Rank rank = rules.rankOf(work);
        OffsetDateTime now = OffsetDateTime.now(clock);
        long next = inventory.lastSalaryAt(member).map(last -> Math.max(0, Duration.between(now, last.plus(SALARY_EVERY)).toSeconds())).orElse(0L);
        int count = inventory.countToday(member, SALARY);
        /* 오늘 받은 급여 합계: 오늘 받은 횟수 × 지금 급여(오늘 승진했으면 근사값) */
        return new BadgeViewDTO(inventory.nickname(member).orElse("연구원"), rank, rules.nextRank(work), work, next, count, count * rank.pay(), paid,
            inventory.coins(member), rules.ranks());
    }
}
