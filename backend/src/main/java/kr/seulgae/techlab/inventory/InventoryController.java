package kr.seulgae.techlab.inventory;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 인벤토리 API. 로그인한 회원만 쓴다(가방은 회원에게 묶인다). 버리기·줍기는 위치가 필요해 WebSocket으로 처리한다.
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    public record FishRequest(String species, Integer cm) {}
    public record SnackRequest(String kind) {}

    private final InventoryService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;

    public InventoryController(InventoryService service, WriteRateLimiter limiter, AuthService auth) { this.service = service; this.limiter = limiter; this.auth = auth; }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    @GetMapping
    public InventoryService.View view(HttpServletRequest request) { return service.view(member(request)); }

    /** 낚시에서 잡은 물고기를 가방에 넣는다. */
    @PostMapping("/fish")
    public InventoryService.View storeFish(@RequestBody(required = false) FishRequest body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        service.storeFish(member, body == null ? null : body.species(), body == null ? null : body.cm());
        return service.view(member);
    }

    /** 로비 데스크 간식(CAKE 3원 HP +10, COFFEE 2원 피로도 +5). 가득이면 422, 동전 부족 409. */
    @PostMapping("/snack")
    public InventoryService.View buySnack(@RequestBody(required = false) SnackRequest body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        return service.buySnack(member, body == null ? null : body.kind());
    }

    /** 오락실 한 판(동전 1원, HP -3, 피로도 -5). 지치면 423, 동전 부족 409. @return {"coins": 남은 동전} */
    @PostMapping("/arcade")
    public Map<String, Integer> playArcade(HttpServletRequest request) {
        return Map.of("coins", service.playArcade(member(request)));
    }
}
