package kr.seulgae.techlab.office.qa.entity;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * QA 티켓(tb_lab_qa_ticket). status는 공통코드 QA_STATUS(REGISTERED·IN_PROGRESS·RESOLVED), statusName은 그 이름.
 *
 * @author 길태형
 * @version 1.0, QA 게시판 개편
 * @see None
 */
public record QaTicket(UUID id, String title, String content, String status, String statusName, String author,
                       OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
