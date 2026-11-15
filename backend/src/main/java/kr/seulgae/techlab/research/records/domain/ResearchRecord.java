package kr.seulgae.techlab.research.records.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 연구 기록의 상세 내용과 DB에서 부여한 작성 시각을 전달하는 모델이다.
 *
 * @param id 기록 식별자
 * @param title 제목
 * @param summary 요약
 * @param content 본문
 * @param createdAt 작성 시각
 * @author seulgae
 * @version 1.0, 연구 기록 상세 모델 문서화
 * @see "None"
 */
public record ResearchRecord(UUID id, String title, String summary, String content, OffsetDateTime createdAt) {}
