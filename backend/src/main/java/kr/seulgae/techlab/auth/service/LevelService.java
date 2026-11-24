package kr.seulgae.techlab.auth.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.entity.*;

/**
 * LevelService 기능 명세(구현: LevelServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see "None"
 */
public interface LevelService {
    int USER = 1, OPERATOR = 2, ADMIN = 3, REASON_MAX = 200;

    int level(UUID member);

    MyLevelDTO mine(UUID member);

    /** 등급 신청. 지금보다 높은 등급(2~3)만, 사유 1~200자. 이미 검토 중이면 409 */
    LevelRequest apply(UUID member, Integer level, String reason);

    List<LevelRequest> pending();

    /** 관리자가 승인·반려한다. 이미 처리된 신청이면 409 */
    LevelRequest decide(UUID admin, UUID requestId, boolean approve);
}
