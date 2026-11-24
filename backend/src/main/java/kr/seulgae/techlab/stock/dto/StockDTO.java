package kr.seulgae.techlab.stock.dto;

import java.util.List;

/**
 * 종목 화면 값: 현재가, 직전 시세 대비 등락(%), 최근 시세(차트, 오래된 것부터).
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see "None"
 */
public record StockDTO(String code, String name, String summary, int price, double changePct, List<Integer> history) {}
