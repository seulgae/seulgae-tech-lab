package kr.seulgae.techlab.research.records.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 본문을 제외한 연구 기록의 목록용 요약 모델이다.
 *
 * @param id 기록 식별자
 * @param title 제목
 * @param summary 요약
 * @param createdAt 작성 시각
 * @param done 완료 표시(누구나 체크·해제하는 공유 상태, V4)
 * @author seulgae
 * @version 1.0, 연구 기록 요약 모델 문서화
 * @see "None"
 */
public record ResearchSummary(UUID id, String title, String summary, OffsetDateTime createdAt, boolean done) {}
