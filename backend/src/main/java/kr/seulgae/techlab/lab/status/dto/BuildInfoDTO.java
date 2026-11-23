package kr.seulgae.techlab.lab.status.dto;

/**
 * 개발 연구실 컴퓨터 패널의 응답이다.
 * @author seulgae
 * @version 1.0, 빌드 버전·커밋·시각
 * @see "None"
 */
public record BuildInfoDTO(String version, String commit, String builtAt, String javaVersion) {}
