package kr.seulgae.techlab.stock.entity;

import java.time.OffsetDateTime;

/**
 * 가상 종목 한 줄(tb_lab_stock): 현재가와 한 번 움직일 때 최대 등락폭, 마지막으로 움직인 시각.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
public record Stock(String code, String name, String summary, int price, int volatilityPct, OffsetDateTime updatedAt) {}
