package kr.seulgae.techlab.inventory.entity;

/** HP·기력(일지 #10). 기력은 남은 힘이라 높을수록 좋다. 최대치는 회원별(기본 50). */
public record Vitals(int hp, int hpMax, int fatigue, int fatigueMax) {}
