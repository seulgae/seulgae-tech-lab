package kr.seulgae.techlab.badge.service;

import java.time.Duration;
import java.util.UUID;
import kr.seulgae.techlab.badge.dto.BadgeViewDTO;
import kr.seulgae.techlab.badge.entity.Rank;

/**
 * 사원증·급여 명세(구현: BadgeServiceImpl).
 * 접속해 있는 동안 화면이 1분마다 tick을 보내면, 마지막 급여에서 10분이 지났을 때 직급별 급여를 준다.
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see None
 */
public interface BadgeService {
    /** 급여 간격 */
    Duration SALARY_EVERY = Duration.ofMinutes(10);
    /** 공통코드 COIN_REASON */
    String SALARY = "SALARY";

    /**
     * 사원증 화면 값.
     *
     * @param member 회원 ID
     * @return 사원증
     */
    BadgeViewDTO view(UUID member);

    /**
     * 급여 차례면 급여를 준다(아니면 남은 시간만 돌려준다).
     *
     * @param member 회원 ID
     * @return 사원증(paid에 방금 받은 급여)
     */
    BadgeViewDTO tick(UUID member);

    /**
     * 일을 하나 완료했다(오늘 업무 보상을 받음): 누적 수를 올리고, 직급이 오르면 HP·기력 최대치를 올려 가득 채운다.
     *
     * @param member 회원 ID
     * @return 새로 오른 직급(승진하지 않았으면 null)
     */
    Rank completeWork(UUID member);
}
