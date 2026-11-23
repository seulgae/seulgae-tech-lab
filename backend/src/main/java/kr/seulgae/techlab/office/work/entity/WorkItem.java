package kr.seulgae.techlab.office.work.entity;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 사무실 업무 게시판 기록 하나. QA 글(parentId 없음)이 티켓이고, 유지보수·운영 기록은 parentId로 티켓에 연결된다.
 *
 * @param id 기록 식별자
 * @param parentId 연결된 QA 티켓(QA 글이면 null)
 * @param category 공통코드 WORK_CATEGORY(QA, MAINTENANCE, OPERATION)
 * @param status 공통코드 WORK_STATUS. QA 티켓은 진행 상태, 유지보수·운영 기록은 그 기록이 남긴 결과
 * @param title 제목(유지보수·운영 기록은 티켓 제목)
 * @param content QA 내용, 조치 현황, 점검 결과
 * @param guide 유지보수 가이드(유지보수 기록만)
 * @param createdAt 작성 시각
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
public record WorkItem(UUID id, UUID parentId, String category, String status, String title, String content, String guide, OffsetDateTime createdAt) {
    public static final String QA = "QA", MAINTENANCE = "MAINTENANCE", OPERATION = "OPERATION";
    public static final String REGISTERED = "REGISTERED", IN_PROGRESS = "IN_PROGRESS", RESOLVED = "RESOLVED", APPROVED = "APPROVED", REJECTED = "REJECTED";
}
