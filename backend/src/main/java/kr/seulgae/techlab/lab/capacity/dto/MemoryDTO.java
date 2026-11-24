package kr.seulgae.techlab.lab.capacity.dto;

import java.util.List;


/**
 * 화면·API로 주고받는 값(MemoryDTO에서 분리).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리
 * @see "None"
 */
public record MemoryDTO(double usedPercent, long totalMb, long usedMb, long availableMb, long buffCacheMb, long swapTotalMb, long swapUsedMb,
                     boolean warning, List<CapacityPointDTO> history) {}
