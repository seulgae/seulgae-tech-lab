package kr.seulgae.techlab.badge.dto;

import java.util.List;
import kr.seulgae.techlab.badge.entity.Rank;

/**
 * 사원증 화면 값: 닉네임, 지금·다음 직급, 누적 일 완료 수, 다음 급여까지 남은 초, 오늘 받은 급여 횟수와 합계, 방금 받은 급여(없으면 0), 직급표.
 *
 * @author 길태형
 * @version 1.0, 사원증·급여
 * @see "None"
 */
public record BadgeViewDTO(String nickname, Rank rank, Rank next, int workCount, long nextSalarySeconds, int salaryCountToday,
                           int salaryToday, int paid, int coins, List<Rank> ranks) {}
