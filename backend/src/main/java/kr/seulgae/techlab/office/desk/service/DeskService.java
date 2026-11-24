package kr.seulgae.techlab.office.desk.service;

import java.util.UUID;
import kr.seulgae.techlab.office.desk.dto.DeskViewDTO;
import kr.seulgae.techlab.office.desk.dto.JavaAnswerDTO;

/**
 * 내 자리 컴퓨터 명세(구현: DeskServiceImpl).
 * 메일: 오늘 업무(낚시·오락실·커피·게시판·자바 연습)는 서버 기록으로 자동 체크되고, 모두 하면 보상을 한 번 받는다.
 * 개발: 자바 printf 형식 문자열을 채워 출력이 맞으면 동전 1원(하루 3번까지).
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see "None"
 */
public interface DeskService {
    int DAILY_REWARD = 5, JAVA_REWARD = 1, JAVA_DAILY_REWARDS = 3, FORMAT_MAX = 100;
    /** 공통코드 COIN_REASON */
    String DAILY_TASKS = "DAILY_TASKS", JAVA_PRACTICE = "JAVA_PRACTICE";

    /**
     * 화면 값.
     *
     * @param member 회원 ID
     * @return 오늘 업무·자바 문제
     */
    DeskViewDTO view(UUID member);

    /**
     * 오늘 업무를 모두 했으면 보상을 받는다(하루 한 번).
     *
     * @param member 회원 ID
     * @return 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 아직 덜 했으면 409, 이미 받았으면 409
     */
    DeskViewDTO claim(UUID member);

    /**
     * 자바 printf 답을 확인한다. 서버가 실제 String.format으로 출력을 만들어 비교한다.
     *
     * @param member 회원 ID
     * @param problemId 문제
     * @param format 형식 문자열
     * @return 출력·정답 여부·보상 여부(형식이 틀리면 error)
     * @exception org.springframework.web.server.ResponseStatusException 없는 문제 404, 형식이 너무 길면 400
     */
    JavaAnswerDTO answer(UUID member, String problemId, String format);
}
