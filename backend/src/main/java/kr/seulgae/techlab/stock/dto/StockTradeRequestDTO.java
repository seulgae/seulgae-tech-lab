package kr.seulgae.techlab.stock.dto;

/**
 * 매수·매도 요청: 종목 코드와 수량.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see None
 */
public record StockTradeRequestDTO(String code, Integer quantity) {}
