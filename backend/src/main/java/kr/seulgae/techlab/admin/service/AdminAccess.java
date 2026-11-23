package kr.seulgae.techlab.admin.service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

/**
 * AdminAccess 기능 명세(구현: AdminAccessImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface AdminAccess {
    boolean isAdmin(UUID memberId);

    /** 로그인한 관리자 회원 id. 로그인하지 않았으면 401, 관리자가 아니면 403 */
    UUID require(HttpServletRequest request);
}
