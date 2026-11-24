package kr.seulgae.techlab.savings.entity;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 적금 한 건(tb_lab_savings). closedAt·payout이 비어 있으면 진행 중이다.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see "None"
 */
public record Savings(UUID id, int principal, int termDays, int ratePct, OffsetDateTime createdAt, OffsetDateTime maturesAt,
                      OffsetDateTime closedAt, Integer payout) {}
