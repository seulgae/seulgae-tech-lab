package kr.seulgae.techlab.inventory.dto;

/** 식물 흔들기 결과: 받은 동전(꽝이면 0)과 지금 잔액 */
public record PlantResultDTO(int won, int coins) {}
