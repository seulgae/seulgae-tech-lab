package kr.seulgae.techlab.office.desk.dto;

import java.util.List;

/**
 * 자바 printf 연습 문제: 화면에 보일 인자 코드(args)와 나와야 할 출력. 형식 문자열은 연구원이 채운다.
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see None
 */
public record JavaProblemDTO(String id, String title, String description, String argsCode, String expected, List<String> hints) {}
