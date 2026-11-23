package kr.seulgae.techlab.lab.status.dto;

/**
 * 방별 현재 접속자 수이다.
 * @author seulgae
 * @version 1.0, 서버 상태 패널의 방 목록
 * @see "None"
 */
public record RoomCountDTO(String id, String name, int players) {}
