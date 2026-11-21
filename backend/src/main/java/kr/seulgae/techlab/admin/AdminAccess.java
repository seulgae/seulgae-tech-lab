package kr.seulgae.techlab.admin;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.auth.LevelRequestStore;
import kr.seulgae.techlab.auth.LevelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 관리자 확인. IP가 바뀌어도 되도록 로그인 세션의 회원으로만 판단한다.
 * 회원 등급이 3(관리자)이면 관리자다. 설정 {@code lab.admin.member-ids}(운영 Compose LAB_ADMIN_MEMBER_IDS)의 회원도
 * 관리자로 둔다(등급을 처음 정하기 전에 방장이 잠기지 않게 하는 안전장치).
 *
 * @author seulgae
 * @version 1.0, 관리자실 쿼리 콘솔
 * @see "None"
 */
@Component
public class AdminAccess {
    private final Set<UUID> admins;
    private final AuthService auth;
    private final LevelRequestStore levels;

    /** 테스트용: 등급 없이 설정된 id만 본다. */
    public AdminAccess(AuthService auth, String memberIds) { this(auth, null, memberIds); }

    @Autowired
    public AdminAccess(AuthService auth, LevelRequestStore levels, @Value("${lab.admin.member-ids:}") String memberIds) {
        this.auth = auth;
        this.levels = levels;
        this.admins = Arrays.stream(memberIds.split(",")).map(String::trim).filter(id -> !id.isEmpty()).map(UUID::fromString)
            .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(UUID memberId) {
        return memberId != null && (admins.contains(memberId) || levels != null && levels.level(memberId) >= LevelService.ADMIN);
    }

    /** 로그인한 관리자 회원 id. 로그인하지 않았으면 401, 관리자가 아니면 403 */
    public UUID require(HttpServletRequest request) {
        var member = auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required"));
        if (!isAdmin(member.id())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin only");
        return member.id();
    }
}
