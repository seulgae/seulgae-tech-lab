package kr.seulgae.techlab.auth.dto;

/**
 * 카카오 회원번호와 프로필 닉네임
 * @param id 카카오 회원번호
 * @param nickname 프로필 닉네임, 동의하지 않았으면 null
 * @author seulgae
 * @version 1.0, 카카오 사용자
 * @see "None"
 */
public record KakaoUserDTO(long id, String nickname) {}
