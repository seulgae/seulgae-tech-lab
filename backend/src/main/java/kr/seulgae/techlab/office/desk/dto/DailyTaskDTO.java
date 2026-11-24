package kr.seulgae.techlab.office.desk.dto;

/**
 * 오늘 업무 한 줄: 코드, 할 일, 어디서 하는지, 오늘 했는지.
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see "None"
 */
public record DailyTaskDTO(String code, String title, String where, boolean done) {}
