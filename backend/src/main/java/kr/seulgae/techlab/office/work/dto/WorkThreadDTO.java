package kr.seulgae.techlab.office.work.dto;

import java.util.List;
import static kr.seulgae.techlab.office.work.entity.WorkItem.*;
import kr.seulgae.techlab.office.work.entity.*;

/** 티켓 상세: QA 티켓과 연결된 유지보수·운영 기록(작성순) */
public record WorkThreadDTO(WorkItem ticket, List<WorkItem> records) {}
