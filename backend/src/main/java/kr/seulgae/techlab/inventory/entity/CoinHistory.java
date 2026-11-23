package kr.seulgae.techlab.inventory.entity;

import java.time.OffsetDateTime;
import java.util.UUID;


/** 은행 거래 내역 한 줄: 변동, 사유 코드와 이름, 송금 상대 닉네임(없으면 null) */
public record CoinHistory(UUID id, int amount, String reason, String reasonName, String counterpart, OffsetDateTime createdAt) {}
