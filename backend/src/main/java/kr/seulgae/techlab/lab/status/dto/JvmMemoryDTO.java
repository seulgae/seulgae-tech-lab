package kr.seulgae.techlab.lab.status.dto;

/**
 * MiB 단위로 반올림한 JVM 힙 사용량이다.
 * @author seulgae
 * @version 1.0, 서버 상태 패널의 메모리 표시
 * @see "None"
 */
public record JvmMemoryDTO(long usedMb, long maxMb) {}
