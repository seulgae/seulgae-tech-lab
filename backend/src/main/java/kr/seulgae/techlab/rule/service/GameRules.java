package kr.seulgae.techlab.rule.service;

import java.util.List;
import java.util.Optional;
import java.util.function.LongSupplier;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.Snack;
import kr.seulgae.techlab.rule.repository.RuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 게임 규칙(행동 비용·간식·직급). 운영 DB 테이블을 1분마다 다시 읽어 메모리에 두고 쓴다(요청마다 DB를 읽지 않음).
 * DB를 읽지 못하면 마지막으로 읽은 값, 그것도 없으면 V23 시드와 같은 기본값을 쓴다.
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see None
 */
@Component
public class GameRules {
    private static final Logger LOG = LoggerFactory.getLogger(GameRules.class);
    /** 테이블을 다시 읽는 간격 */
    public static final long REFRESH_MS = 60_000;

    /** V23 시드와 같은 기본값(DB 없는 테스트·로컬 실행과 첫 읽기 실패용) */
    public static final List<ActionCost> DEFAULT_ACTIONS = List.of(
        new ActionCost(ActionCost.IDEA_POST, "아이디어 글 올리기", 3, 5, "내 자리 컴퓨터 아이디어 기획 게시판"),
        new ActionCost(ActionCost.QA_REGISTER, "QA 티켓 등록", 3, 5, "내 자리 컴퓨터 QA 게시판"),
        new ActionCost(ActionCost.QA_MOVE, "QA 단계 변경", 3, 5, "QA 티켓을 조치 중·조치 완료로"),
        new ActionCost(ActionCost.ARCADE_PLAY, "오락실 한 판", 3, 5, "오락실 메인 오락기(벽돌 부수기 등)"));
    public static final List<Snack> DEFAULT_SNACKS = List.of(
        new Snack("CAKE", "케이크", 3, 10, 0, "LOBBY"), new Snack("COFFEE", "커피", 2, 0, 5, "LOBBY"),
        new Snack("COLA", "콜라", 2, 0, 5, "VENDING"), new Snack("CIDER", "사이다", 2, 0, 5, "VENDING"),
        new Snack("FANTA", "환타", 2, 0, 5, "VENDING"), new Snack("WATER", "물", 1, 0, 2, "VENDING"));

    /** 한 번에 읽은 규칙 묶음 */
    public record Rules(List<ActionCost> actions, List<Snack> snacks, List<Rank> ranks) {}

    private final RuleRepository repository;
    private final LongSupplier clock;
    private volatile Rules current = new Rules(DEFAULT_ACTIONS, DEFAULT_SNACKS, Rank.DEFAULTS);
    private volatile long loadedAt = Long.MIN_VALUE / 2;

    @Autowired
    public GameRules(RuleRepository repository) { this(repository, System::currentTimeMillis); }

    public GameRules(RuleRepository repository, LongSupplier clock) { this.repository = repository; this.clock = clock; }

    /** @return DB 없이 기본값만 쓰는 규칙(테스트·기본 생성자용) */
    public static GameRules defaults() {
        return new GameRules(new RuleRepository() {
            @Override public List<ActionCost> actionCosts() { return DEFAULT_ACTIONS; }
            @Override public List<Snack> snacks() { return DEFAULT_SNACKS; }
            @Override public List<Rank> ranks() { return Rank.DEFAULTS; }
        });
    }

    /** @return 지금 규칙(1분이 지났으면 다시 읽는다) */
    public Rules rules() {
        long now = clock.getAsLong();
        if (now - loadedAt >= REFRESH_MS) reload(now);
        return current;
    }

    /** 운영자가 테이블을 고친 뒤 바로 반영하고 싶을 때(관리자 쿼리 콘솔 실행 뒤 등) */
    public void invalidate() { loadedAt = Long.MIN_VALUE / 2; }

    private synchronized void reload(long now) {
        if (now - loadedAt < REFRESH_MS) return;
        try {
            var ranks = repository.ranks();
            /* 0회 직급이 없으면 직급을 정할 수 없으니 기본값을 쓴다 */
            if (ranks.isEmpty() || ranks.get(0).minWork() != 0) throw new IllegalStateException("tb_lab_rank needs a row with min_work = 0");
            current = new Rules(List.copyOf(repository.actionCosts()), List.copyOf(repository.snacks()), List.copyOf(ranks));
        } catch (RuntimeException exception) {
            LOG.warn("Game rule tables could not be read; keeping previous values: {}", exception.getMessage());
        }
        loadedAt = now;
    }

    /**
     * 행동 비용(테이블에 없으면 비용 없음).
     *
     * @param code 행동 코드
     * @return 비용
     */
    public ActionCost action(String code) {
        return rules().actions().stream().filter(item -> item.code().equals(code)).findFirst().orElse(new ActionCost(code, code, 0, 0, ""));
    }

    /**
     * 간식 하나.
     *
     * @param code 간식 코드
     * @return 간식(없으면 빈 값)
     */
    public Optional<Snack> snack(String code) { return rules().snacks().stream().filter(item -> item.code().equals(code)).findFirst(); }

    /** @return 직급(낮은 직급부터) */
    public List<Rank> ranks() { return rules().ranks(); }

    /** @param work 누적 일 완료 수 @return 직급 */
    public Rank rankOf(int work) { return Rank.of(ranks(), work); }

    /** @param work 누적 일 완료 수 @return 다음 직급(최고면 null) */
    public Rank nextRank(int work) { return Rank.next(ranks(), work); }
}
