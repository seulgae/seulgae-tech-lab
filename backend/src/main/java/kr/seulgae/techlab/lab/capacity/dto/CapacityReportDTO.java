package kr.seulgae.techlab.lab.capacity.dto;

/**
 * 화면·API로 주고받는 값(CapacityReportDTO에서 분리).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리
 * @see "None"
 */
public record CapacityReportDTO(ProbeDTO probe, CpuDTO cpu, MemoryDTO memory, HeapDTO heap, UptimeDTO uptime, String serverTime) {}
