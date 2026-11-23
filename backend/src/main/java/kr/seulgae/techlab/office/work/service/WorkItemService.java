package kr.seulgae.techlab.office.work.service;

import java.util.UUID;
import static kr.seulgae.techlab.office.work.entity.WorkItem.*;
import kr.seulgae.techlab.office.work.dto.*;
import kr.seulgae.techlab.office.work.entity.*;

/**
 * WorkItemService 기능 명세(구현: WorkItemServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface WorkItemService {
    WorkBoardDTO board(String board);

    WorkThreadDTO thread(UUID id);

    /** 1번 오피스: QA 등록. 새 티켓은 "등록" 상태로 2번 유지보수 게시판에 올라간다. */
    WorkItem createQa(String title, String content, UUID author);

    /** 2번 오피스: 조치 현황과 가이드를 남긴다. done이면 "조치 완료"로 4번 운영 점검에 넘긴다. */
    WorkThreadDTO maintain(UUID ticketId, String content, String guide, boolean done, UUID author);

    /** 4번 오피스: 정상 작동을 점검하고 최종 승인하거나, 반려해 2번 유지보수로 돌려보낸다. */
    WorkThreadDTO operate(UUID ticketId, String content, boolean approved, UUID author);
}
