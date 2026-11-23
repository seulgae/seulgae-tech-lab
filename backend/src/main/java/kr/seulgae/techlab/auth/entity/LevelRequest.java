package kr.seulgae.techlab.auth.entity;

import java.time.OffsetDateTime;
import java.util.UUID;


/**
 * 등급 신청
 * @param status PENDING(검토 중), APPROVED(승인), REJECTED(반려)
 * @param nickname 신청한 회원 닉네임(관리자 목록에서 보여 준다)
 */
public record LevelRequest(UUID id, UUID memberId, String nickname, int requestedLevel, String reason, String status, OffsetDateTime createdAt) {}
