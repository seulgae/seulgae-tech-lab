package kr.seulgae.techlab.inventory.entity;

/** HP·피로도(일지 #10). 피로도는 남은 기력처럼 높을수록 좋다. 최대치는 회원별(기본 50). */
public record Vitals(int hp, int hpMax, int fatigue, int fatigueMax) {}
