package kr.seulgae.techlab.lab.capacity.dto;

/** 수집 상태: OK, NOT_CONFIGURED(SSH 미설정), 또는 실패 분류(CONNECT·TIMEOUT·EXIT·PARSE…) */
public record ProbeDTO(String state, String collectedAt) {}
