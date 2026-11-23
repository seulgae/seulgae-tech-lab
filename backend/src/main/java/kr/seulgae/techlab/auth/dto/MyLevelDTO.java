package kr.seulgae.techlab.auth.dto;

import kr.seulgae.techlab.auth.entity.*;

/** 내 등급과 가장 최근 신청(없으면 null) */
public record MyLevelDTO(int level, LevelRequest request) {}
