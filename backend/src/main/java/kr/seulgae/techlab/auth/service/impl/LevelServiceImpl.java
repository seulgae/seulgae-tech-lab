package kr.seulgae.techlab.auth.service.impl;

import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.entity.*;
import kr.seulgae.techlab.auth.service.*;
import kr.seulgae.techlab.auth.repository.*;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 회원 등급(1 일반 사용자, 2 운영자, 3 관리자)과 등급 신청.
 * 회원은 개발 연구실 관리자실 앞 작은 컴퓨터에서 운영자·관리자를 신청하고, 관리자는 관리자실에서 승인·반려한다.
 *
 * @author seulgae
 * @version 1.0, 회원 등급·관리자 신청
 * @see "None"
 */
@Service
public class LevelServiceImpl implements LevelService {


    private final LevelRequestRepository store;

    public LevelServiceImpl(LevelRequestRepository store) { this.store = store; }

    public int level(UUID member) { return store.level(member); }

    public MyLevelDTO mine(UUID member) { return new MyLevelDTO(store.level(member), store.latest(member).orElse(null)); }

    /** 등급 신청. 지금보다 높은 등급(2~3)만, 사유 1~200자. 이미 검토 중이면 409 */
    @Transactional
    public LevelRequest apply(UUID member, Integer level, String reason) {
        if (level == null || level < OPERATOR || level > ADMIN) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Level must be 2 or 3");
        if (level <= store.level(member)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Already at this level");
        String text = reason == null ? "" : reason.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > REASON_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason must be 1-200 characters");
        return store.create(member, level, text).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Request already pending"));
    }

    public List<LevelRequest> pending() { return store.pending(); }

    /** 관리자가 승인·반려한다. 이미 처리된 신청이면 409 */
    @Transactional
    public LevelRequest decide(UUID admin, UUID requestId, boolean approve) {
        return store.decide(requestId, approve, admin).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Request already decided"));
    }
}
