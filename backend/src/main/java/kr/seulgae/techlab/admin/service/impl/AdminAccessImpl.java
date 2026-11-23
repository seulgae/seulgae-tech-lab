package kr.seulgae.techlab.admin.service.impl;

import kr.seulgae.techlab.admin.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.auth.repository.LevelRequestRepository;
import kr.seulgae.techlab.auth.service.LevelService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 관리자 확인. IP가 바뀌어도 되도록 로그인 세션의 회원으로만 판단한다.
 * 회원 등급이 3(관리자)인 회원만 관리자다(lab.tb_lab_member.level).
 *
 * @author seulgae
 * @version 1.1, 등급 3만 관리자(설정 id 예외 제거)
 * @see "None"
 */
@Component
public class AdminAccessImpl implements AdminAccess {
    private final AuthService auth;
    private final LevelRequestRepository levels;

    public AdminAccessImpl(AuthService auth, LevelRequestRepository levels) {
        this.auth = auth;
        this.levels = levels;
    }

    public boolean isAdmin(UUID memberId) {
        return memberId != null && levels.level(memberId) >= LevelService.ADMIN;
    }

    /** 로그인한 관리자 회원 id. 로그인하지 않았으면 401, 관리자가 아니면 403 */
    public UUID require(HttpServletRequest request) {
        var member = auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required"));
        if (!isAdmin(member.id())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin only");
        return member.id();
    }
}
