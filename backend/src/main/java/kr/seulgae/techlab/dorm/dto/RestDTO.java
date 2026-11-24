package kr.seulgae.techlab.dorm.dto;

/**
 * 침대 휴식 결과: 이번에 회복했는지, 회복 뒤 HP·기력, 다음 회복까지 간격.
 *
 * @author 길태형
 * @version 1.0, 기숙사 침대 휴식
 * @see "None"
 */
public record RestDTO(boolean recovered, int hp, int hpMax, int fatigue, int fatigueMax, int everySec, int hpGain, int fatigueGain, boolean unlimited) {}
