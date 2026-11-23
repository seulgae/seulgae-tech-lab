package kr.seulgae.techlab.dorm.entity;

import java.util.UUID;

/**
 * 회원이 산 가구 한 행(tb_lab_member_furniture). placed가 false면 보관함, true면 기숙사의 (x, y)에 놓여 있다.
 * x는 바닥 가운데, y는 바닥 아래 끝(그림의 아래 기준점)이다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
public record MemberFurniture(UUID id, String code, boolean placed, Integer x, Integer y) {}
