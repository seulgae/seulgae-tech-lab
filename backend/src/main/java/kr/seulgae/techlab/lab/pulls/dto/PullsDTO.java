package kr.seulgae.techlab.lab.pulls.dto;

import java.util.List;


/** 열린 PR, 최근 머지된 PR, 마지막으로 받아 온 시각, 실패해서 예전 목록인지 */
public record PullsDTO(String repo, List<PullDTO> open, List<PullDTO> merged, String fetchedAt, boolean stale) {}
