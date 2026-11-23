package kr.seulgae.techlab.inventory.dto;

/** 바닥 아이템을 화면에 필요한 값만으로 */
public record GroundItemDTO(String id, String kind, String name, Integer sizeCm, double x, double y) {}
