package kr.seulgae.techlab.rule.service;

import java.util.List;
import java.util.Optional;
import java.util.function.LongSupplier;
import kr.seulgae.techlab.badge.entity.Rank;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.GameValue;
import kr.seulgae.techlab.rule.entity.Snack;
import kr.seulgae.techlab.rule.repository.RuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 행동 비용·간식·직급·숫자 규칙을 메모리에 캐시한다. 갱신 간격이 지나거나 무효화된 뒤 첫 조회에서 DB를 읽는다.
 * DB를 읽지 못하면 마지막으로 읽은 값, 그것도 없으면 V23·V24 시드와 같은 기본값을 쓴다.
 *
 * @author 길태형
 * @version 1.1, 새 행동 비용·숫자 규칙(V24)
 * @see RuleRepository
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
        new ActionCost(ActionCost.ARCADE_PLAY, "오락실 한 판", 3, 5, "오락실 메인 오락기(벽돌 부수기 등)"),
        new ActionCost(ActionCost.GAMBLE_BET, "오락실 내기 한 판", 0, 3, "오락실 홀짝·사다리"),
        new ActionCost(ActionCost.FISH_CATCH, "물고기 낚기", 0, 4, "낚은 물고기를 보관함에 넣을 때"),
        new ActionCost(ActionCost.JAVA_ANSWER, "자바 연습 문제 풀기", 0, 2, "내 자리 컴퓨터 자바 연습(답 제출마다)"),
        new ActionCost(ActionCost.STOCK_TRADE, "주식 거래", 0, 1, "폰 주식 앱 사기·팔기"),
        new ActionCost(ActionCost.FURNITURE_PLACE, "가구 배치", 2, 0, "개인 기숙사에 가구 놓기"));
    public static final List<Snack> DEFAULT_SNACKS = List.of(
        new Snack("CAKE", "케이크", 3, 10, 0, "LOBBY"), new Snack("COFFEE", "커피", 2, 0, 5, "LOBBY"),
        new Snack("COLA", "콜라", 2, 0, 5, "VENDING"), new Snack("CIDER", "사이다", 2, 0, 5, "VENDING"),
        new Snack("FANTA", "환타", 2, 0, 5, "VENDING"), new Snack("WATER", "물", 1, 0, 2, "VENDING"),
        new Snack("LUNCHBOX", "도시락", 6, 25, 0, "VENDING"), new Snack("ENERGY_DRINK", "에너지드링크", 5, 0, 20, "VENDING"));
    /** 숫자 규칙 기본값(V24 시드와 같음) */
    public static final List<GameValue> DEFAULT_VALUES = List.of(
        new GameValue(GameValue.REST_EVERY_SEC, "침대 휴식 간격", 60, "침대에 누워 있으면 이 초마다 한 번 회복한다(초)"),
        new GameValue(GameValue.REST_HP, "침대 휴식 HP 회복", 3, "한 번 회복할 때 오르는 HP"),
        new GameValue(GameValue.REST_FATIGUE, "침대 휴식 기력 회복", 3, "한 번 회복할 때 오르는 기력"));

    /** 한 번에 읽은 규칙 묶음 */
    public record Rules(List<ActionCost> actions, List<Snack> snacks, List<Rank> ranks, List<GameValue> values) {}

    private final RuleRepository repository;
    private final LongSupplier clock;
    private volatile Rules current = new Rules(DEFAULT_ACTIONS, DEFAULT_SNACKS, Rank.DEFAULTS, DEFAULT_VALUES);
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
            @Override public List<GameValue> values() { return DEFAULT_VALUES; }
        });
    }

    /** @return 캐시가 만료되었으면 갱신을 시도한 뒤 현재 규칙을 반환한다. */
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
            /* 숫자 규칙은 표에 없는 코드를 기본값으로 채워 둔다(안내 화면에도 모두 보이게) */
            var values = new java.util.ArrayList<>(repository.values());
            for (GameValue fallback : DEFAULT_VALUES) if (values.stream().noneMatch(item -> item.code().equals(fallback.code()))) values.add(fallback);
            current = new Rules(List.copyOf(repository.actionCosts()), List.copyOf(repository.snacks()), List.copyOf(ranks), List.copyOf(values));
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

    /**
     * 숫자 규칙 값(표와 기본값 모두에 없으면 0).
     *
     * @param code 규칙 코드
     * @return 값
     */
    public int value(String code) {
        return rules().values().stream().filter(item -> item.code().equals(code)).mapToInt(GameValue::value).findFirst().orElse(0);
    }

    /**
     * 누적 업무 완료 수에서 현재 직급을 결정한다.
     *
     * @param work 누적 업무 완료 수
     * @return 현재 직급
     */
    public Rank rankOf(int work) { return Rank.of(ranks(), work); }

    /**
     * 누적 업무 완료 수에서 다음 승진 직급을 찾는다.
     *
     * @param work 누적 업무 완료 수
     * @return 다음 직급. 최고 직급이면 null
     */
    public Rank nextRank(int work) { return Rank.next(ranks(), work); }
}
