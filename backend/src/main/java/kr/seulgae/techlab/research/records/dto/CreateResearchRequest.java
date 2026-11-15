package kr.seulgae.techlab.research.records.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 연구 기록 등록 요청을 받으며 빈 값과 필드 길이를 검증한다.
 *
 * @param title 제목, 최대 120자
 * @param summary 요약, 최대 500자
 * @param content 본문, 최대 20,000자
 * @author seulgae
 * @version 1.0, 등록 요청과 검증 제약 문서화
 * @see "None"
 */
public record CreateResearchRequest(
    @NotBlank @Size(max = 120) String title,
    @NotBlank @Size(max = 500) String summary,
    @NotBlank @Size(max = 20000) String content
) {}
