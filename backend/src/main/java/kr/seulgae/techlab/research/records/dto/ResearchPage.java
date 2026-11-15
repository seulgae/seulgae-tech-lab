package kr.seulgae.techlab.research.records.dto;

import java.util.List;
import kr.seulgae.techlab.research.records.domain.ResearchSummary;

/**
 * 목록 조회 결과와 다음 페이지 존재 여부를 전달하는 응답이다.
 *
 * @param items 현재 페이지의 연구 기록 요약
 * @param hasMore 다음 페이지 존재 여부
 * @author seulgae
 * @version 1.0, 페이지 응답 계약 문서화
 * @see "None"
 */
public record ResearchPage(List<ResearchSummary> items, boolean hasMore) {}
