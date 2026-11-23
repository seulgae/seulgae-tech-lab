package kr.seulgae.techlab.auth;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 등급 신청 저장소(V10 lab.level_requests). 운영은 PostgreSQL, 테스트·로컬은 메모리 구현을 쓴다.
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 */
public interface LevelRequestStore {
    /**
     * 등급 신청
     * @param status PENDING(검토 중), APPROVED(승인), REJECTED(반려)
     * @param nickname 신청한 회원 닉네임(관리자 목록에서 보여 준다)
     */
    record LevelRequest(UUID id, UUID memberId, String nickname, int requestedLevel, String reason, String status, OffsetDateTime createdAt) {}

    /** 새 신청. 이미 검토 중인 신청이 있으면 빈 값(부분 유니크 인덱스) */
    Optional<LevelRequest> create(UUID memberId, int level, String reason);
    /** 이 회원의 가장 최근 신청 */
    Optional<LevelRequest> latest(UUID memberId);
    /** 검토 중인 신청(오래된 순) */
    List<LevelRequest> pending();
    /**
     * 검토 중인 신청을 승인·반려한다. 승인이면 회원 등급도 요청 등급으로 올린다.
     * @return 처리한 신청(이미 처리됐으면 빈 값)
     */
    Optional<LevelRequest> decide(UUID requestId, boolean approve, UUID decidedBy);
    /** 회원 등급(1 일반, 2 운영자, 3 관리자). 없으면 1 */
    int level(UUID memberId);
}
