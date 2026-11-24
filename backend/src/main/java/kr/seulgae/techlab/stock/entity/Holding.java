package kr.seulgae.techlab.stock.entity;

/**
 * 회원이 가진 주식 한 종목(tb_lab_member_stock): 수량과 산 금액 합계.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
public record Holding(String code, int quantity, int totalCost) {}
