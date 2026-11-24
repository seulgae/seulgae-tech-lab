package kr.seulgae.techlab.rule.entity;

/**
 * 간식·음료(tb_lab_snack): 가격과 회복량, 파는 곳(LOBBY 로비 데스크, VENDING 자판기).
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see None
 */
public record Snack(String code, String name, int price, int hpGain, int fatigueGain, String place) {}
