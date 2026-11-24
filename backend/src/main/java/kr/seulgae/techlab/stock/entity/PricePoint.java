package kr.seulgae.techlab.stock.entity;

import java.time.OffsetDateTime;

/**
 * 시세 기록 한 점(tb_lab_stock_price).
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see "None"
 */
public record PricePoint(String code, OffsetDateTime at, int price) {}
