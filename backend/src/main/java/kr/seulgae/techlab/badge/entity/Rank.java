package kr.seulgae.techlab.badge.entity;

import java.util.List;

/**
 * 연구소 직급. 누적 일 완료 수(오늘 업무 보상을 받은 날 수)로 정하고, 직급마다 10분 급여와 HP·기력 최대치가 다르다.
 * 연구소장은 HP·기력이 무제한(일·오락에서 줄지 않음)이다. 직급표는 운영 DB(tb_lab_rank)에서 읽고(GameRules),
 * DEFAULTS는 DB가 없을 때 쓰는 기본값(V23 시드와 같음)이다.
 *
 * @author 길태형
 * @version 1.1, 직급표를 운영 DB(tb_lab_rank)로
 * @see "None"
 */
public record Rank(String code, String name, int minWork, int pay, int vitalsMax, boolean unlimited) {
    /** 무제한 직급이 DB에 넣는 최대치(열 제한 1~999 안) */
    public static final int UNLIMITED_MAX = 999;

    /** 기본 직급표(낮은 직급부터) */
    public static final List<Rank> DEFAULTS = List.of(
        new Rank("INTERN", "인턴", 0, 1, 50, false),
        new Rank("JUNIOR", "주임", 1, 5, 100, false),
        new Rank("SENIOR", "선임", 5, 10, 150, false),
        new Rank("PRINCIPAL", "책임", 10, 20, 220, false),
        new Rank("CHIEF", "수석", 30, 50, 500, false),
        new Rank("DIRECTOR", "연구소장", 100, 100, UNLIMITED_MAX, true));

    /**
     * 누적 일 완료 수에 맞는 직급.
     *
     * @param ranks 직급표(낮은 직급부터, 첫 직급은 0회)
     * @param workCount 누적 일 완료 수
     * @return 직급
     */
    public static Rank of(List<Rank> ranks, int workCount) {
        Rank found = ranks.get(0);
        for (Rank rank : ranks) if (workCount >= rank.minWork()) found = rank;
        return found;
    }

    /**
     * 다음 직급(최고 직급이면 null).
     *
     * @param ranks 직급표
     * @param workCount 누적 일 완료 수
     * @return 다음 직급
     */
    public static Rank next(List<Rank> ranks, int workCount) {
        int index = ranks.indexOf(of(ranks, workCount));
        return index + 1 < ranks.size() ? ranks.get(index + 1) : null;
    }
}
