package kr.seulgae.techlab.dorm.entity;

/**
 * 가구 카탈로그 한 행(tb_lab_furniture). 가격과 바닥 차지 크기, 캐릭터가 부딪히는지를 서버가 정한다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see "None"
 */
public record Furniture(String code, String name, int price, int width, int height, boolean blocking) {}
