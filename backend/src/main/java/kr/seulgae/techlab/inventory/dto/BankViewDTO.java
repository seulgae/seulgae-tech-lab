package kr.seulgae.techlab.inventory.dto;

import java.util.List;
import kr.seulgae.techlab.inventory.entity.*;

/** 은행 화면: 잔액, 오늘 남은 송금 횟수, 최근 거래 */
public record BankViewDTO(int coins, int transfersLeftToday, List<CoinHistory> history) {}
