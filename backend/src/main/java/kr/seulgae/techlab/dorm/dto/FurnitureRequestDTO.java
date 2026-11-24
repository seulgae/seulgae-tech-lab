package kr.seulgae.techlab.dorm.dto;

/**
 * 가구 요청: 구매는 code, 배치는 id·x·y, 보관은 id만 쓴다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see "None"
 */
public record FurnitureRequestDTO(String code, String id, Integer x, Integer y) {}
