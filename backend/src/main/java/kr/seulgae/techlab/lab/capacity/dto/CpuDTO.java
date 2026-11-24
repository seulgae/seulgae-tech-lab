package kr.seulgae.techlab.lab.capacity.dto;

import java.util.List;


/**
 * 화면·API로 주고받는 값(CpuDTO에서 분리).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리
 * @see "None"
 */
public record CpuDTO(double usedPercent, double user, double system, double ioWait, double load1, double load5, double load15, int cores,
                  double loadPerCore, double jvmProcessPercent, boolean warning, List<CapacityPointDTO> history) {}
