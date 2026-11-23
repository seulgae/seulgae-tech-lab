package kr.seulgae.techlab.office.work.dto;

import java.util.List;
import static kr.seulgae.techlab.office.work.entity.WorkItem.*;
import kr.seulgae.techlab.office.work.entity.*;

/** 게시판 화면: 공통코드(이름 표시용), 처리할 티켓, 이 게시판 카테고리의 기록 */
public record WorkBoardDTO(String board, List<CommonCode> categories, List<CommonCode> statuses, List<WorkItem> inbox, List<WorkItem> entries) {}
