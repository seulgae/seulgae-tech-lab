package kr.seulgae.techlab.office.desk.dto;

import java.util.List;

/**
 * 내 자리 컴퓨터 화면 값: 오늘 업무, 보상(받았는지), 자바 연습 문제와 오늘 받은 연습 보상 횟수, 방금 오른 직급(보상을 받아 승진했을 때만).
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see None
 */
public record DeskViewDTO(List<DailyTaskDTO> tasks, int reward, boolean rewardClaimed, List<JavaProblemDTO> problems,
                          int javaRewardsToday, int javaRewardLimit, int coins, String promotedTo) {}
