package kr.seulgae.techlab.auth.dto;

import kr.seulgae.techlab.auth.entity.*;

/**
 * 로그인 결과. created면 방금 가입한 회원이다.
 * @param member 회원
 * @param created 이번 로그인으로 가입했는지
 * @author seulgae
 * @version 1.0, 로그인 결과
 * @see "None"
 */
public record LoginDTO(Member member, boolean created) {}
