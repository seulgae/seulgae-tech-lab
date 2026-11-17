package kr.seulgae.techlab.admin;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import kr.seulgae.techlab.auth.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 관리자(방장) 확인. IP가 바뀌어도 되도록 로그인 세션의 회원 id로만 판단한다.
 * 관리자 회원 id는 설정 {@code lab.admin.member-ids}(쉼표 구분, 운영은 Compose 환경 변수 LAB_ADMIN_MEMBER_IDS)로 넣는다.
 *
 * @author seulgae
 * @version 1.0, 관리자실 쿼리 콘솔
 * @see "None"
 */
@Component
public class AdminAccess {
    private final Set<UUID> admins;
    private final AuthService auth;

    public AdminAccess(AuthService auth, @Value("${lab.admin.member-ids:}") String memberIds) {
        this.auth = auth;
        this.admins = Arrays.stream(memberIds.split(",")).map(String::trim).filter(id -> !id.isEmpty()).map(UUID::fromString)
            .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(UUID memberId) { return memberId != null && admins.contains(memberId); }

    /** 로그인한 관리자 회원 id. 로그인하지 않았으면 401, 관리자가 아니면 403 */
    public UUID require(HttpServletRequest request) {
        var member = auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required"));
        if (!isAdmin(member.id())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin only");
        return member.id();
    }
}
