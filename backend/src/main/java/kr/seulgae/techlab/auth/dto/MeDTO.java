package kr.seulgae.techlab.auth.dto;

import org.springframework.web.bind.annotation.*;


/**
 * 로그인 사용 가능 여부와 현재 회원(없으면 null)
 * @param kakaoEnabled 카카오 로그인 설정 여부
 * @param member 현재 회원
 * @param admin 관리자 회원이면 true. 관리자실 문과 쿼리 콘솔에 쓴다(실제 권한은 관리자 API가 매번 확인).
 * @param level 회원 등급(1 일반 사용자, 2 운영자, 3 관리자). 로그인하지 않았으면 0
 * @author seulgae
 * @version 1.2, 내 정보 응답(관리자 여부·등급)
 * @see "None"
 */
public record MeDTO(boolean kakaoEnabled, MemberViewDTO member, boolean admin, int level) {}
