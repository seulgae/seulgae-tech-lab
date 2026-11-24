package kr.seulgae.techlab.lab.capacity.dto;

/**
 * 화면·API로 주고받는 값(HeapDTO에서 분리).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리
 * @see "None"
 */
public record HeapDTO(long usedMb, long committedMb, long maxMb, double usedPercent, long nonHeapMb, long gcCount, long gcMillis,
                   int threads, int peakThreads, boolean warning) {}
