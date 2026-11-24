package kr.seulgae.techlab.savings.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.savings.entity.Savings;

/**
 * 적금 저장소 명세(구현: JdbcSavingsRepository, 테스트: InMemorySavingsRepository). 모든 쿼리는 회원으로 묶는다.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
public interface SavingsRepository {
    /**
     * 진행 중인 적금 전부와 최근 찾은 적금을 가입 최신순으로 읽는다.
     *
     * @param member 회원 ID
     * @param closedLimit 찾은 적금을 몇 건까지 보일지
     * @return 적금 목록
     */
    List<Savings> list(UUID member, int closedLimit);

    /**
     * 진행 중인 적금 수.
     *
     * @param member 회원 ID
     * @return 개수
     */
    int openCount(UUID member);

    /**
     * 적금을 만든다.
     *
     * @param member 회원 ID
     * @param principal 원금
     * @param termDays 기간(일)
     * @param ratePct 만기 이자율(%)
     * @param createdAt 가입 시각
     * @param maturesAt 만기 시각
     * @return 새 적금
     */
    Savings create(UUID member, int principal, int termDays, int ratePct, OffsetDateTime createdAt, OffsetDateTime maturesAt);

    /**
     * 내 적금 한 건.
     *
     * @param member 회원 ID
     * @param id 적금 ID
     * @return 적금(내 것이 아니면 빈 값)
     */
    Optional<Savings> find(UUID member, UUID id);

    /**
     * 진행 중인 적금을 찾은 것으로 표시한다. 이미 찾았으면 아무것도 바꾸지 않는다(두 번 받지 않게).
     *
     * @param member 회원 ID
     * @param id 적금 ID
     * @param payout 돌려줄 동전
     * @param closedAt 찾은 시각
     * @return 이번에 표시했으면 true
     */
    boolean close(UUID member, UUID id, int payout, OffsetDateTime closedAt);
}
