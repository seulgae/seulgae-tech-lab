package kr.seulgae.techlab.admin.dto;

import java.util.List;


/**
 * 실행 결과
 * @param columns 조회 결과 열 이름(조회가 아니면 빈 목록)
 * @param rows 조회 결과 행(문자열, NULL은 null)
 * @param truncated 200행을 넘어 잘렸는지
 * @param updated 바뀐 행 수(조회면 null)
 * @param millis 걸린 시간(ms)
 */
public record SqlResultDTO(List<String> columns, List<List<String>> rows, boolean truncated, Integer updated, long millis) {}
