package kr.seulgae.techlab.auth.controller;

import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.entity.*;
import kr.seulgae.techlab.auth.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.admin.service.AdminAccess;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 등급 신청 API. 신청·내 상태는 로그인 회원, 목록·승인·반려는 관리자만(요청마다 확인).
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 */
@RestController
public class LevelController {

    private final LevelService levels;
    private final AuthService auth;
    private final AdminAccess admins;
    private final WriteRateLimiter limiter;

    public LevelController(LevelService levels, AuthService auth, AdminAccess admins, WriteRateLimiter limiter) {
        this.levels = levels; this.auth = auth; this.admins = admins; this.limiter = limiter;
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    @GetMapping("/api/level-requests/me")
    public MyLevelDTO mine(HttpServletRequest request) { return levels.mine(member(request)); }

    @PostMapping("/api/level-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public LevelRequest apply(@RequestBody(required = false) LevelApplyRequestDTO body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        return levels.apply(member, body == null ? null : body.level(), body == null ? null : body.reason());
    }

    @GetMapping("/api/admin/level-requests")
    public List<LevelRequest> pending(HttpServletRequest request) {
        admins.require(request);
        return levels.pending();
    }

    @PostMapping("/api/admin/level-requests/{id}")
    public LevelRequest decide(@PathVariable UUID id, @RequestBody(required = false) LevelDecideRequestDTO body, HttpServletRequest request) {
        var admin = admins.require(request);
        if (body == null || body.approve() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "approve must be true or false");
        return levels.decide(admin, id, body.approve());
    }
}
