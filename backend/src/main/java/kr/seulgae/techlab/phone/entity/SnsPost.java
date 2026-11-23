package kr.seulgae.techlab.phone.entity;

import java.time.OffsetDateTime;
import java.util.UUID;


/**
 * 테이블 한 행을 담는 값(SnsPost에서 분리).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리
 * @see None
 */
public record SnsPost(UUID id, UUID authorId, String nickname, String content, OffsetDateTime createdAt) {}
