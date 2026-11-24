package kr.seulgae.techlab.stock.dto;

import java.util.List;
import kr.seulgae.techlab.stock.entity.Holding;

/**
 * 주식 앱 화면 값: 내 동전, 종목, 내 보유 주식, 오늘 남은 거래 횟수, 다음 시세 변동까지 남은 초.
 *
 * @author 길태형
 * @version 1.0, 주식 앱
 * @see "None"
 */
public record StockViewDTO(int coins, List<StockDTO> stocks, List<Holding> holdings, int tradesLeftToday, long nextTickSeconds) {}
