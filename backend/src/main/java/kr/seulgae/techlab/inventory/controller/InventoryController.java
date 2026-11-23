package kr.seulgae.techlab.inventory.controller;

import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.service.*;
import kr.seulgae.techlab.inventory.event.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.seulgae.techlab.auth.service.AuthService;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
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

    private final InventoryService service;
    private final WriteRateLimiter limiter;
    private final AuthService auth;
    private final LobbyWorld world;
    private final org.springframework.context.ApplicationEventPublisher events;

    public InventoryController(InventoryService service, WriteRateLimiter limiter, AuthService auth, LobbyWorld world,
                               org.springframework.context.ApplicationEventPublisher events) {
        this.service = service; this.limiter = limiter; this.auth = auth; this.world = world; this.events = events;
    }

    /** 바닥이 바뀌면 같은 방에 연결된 사람(회의실)에게 바로 알린다. */
    private List<GroundItemDTO> changed(String room) {
        var items = service.groundView(room);
        events.publishEvent(new GroundChanged(room, items));
        return items;
    }

    private String room(String roomId) {
        if (roomId == null || !world.roomIds().contains(roomId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown room");
        return roomId;
    }

    /** 요청을 검사한다. 위치는 방 크기(800×600) 안이어야 한다. */
    private ItemRequestDTO valid(ItemRequestDTO body) {
        if (body == null || body.itemId() == null || body.x() == null || body.y() == null
            || !(body.x() >= 0 && body.x() <= 800 && body.y() >= 0 && body.y() <= 600)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid item request");
        room(body.room());
        return body;
    }

    private UUID itemId(ItemRequestDTO body) {
        try { return UUID.fromString(body.itemId()); }
        catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid item"); }
    }

    /** 이 방 바닥의 아이템(누구나 볼 수 있다) */
    @GetMapping("/ground")
    public List<GroundItemDTO> ground(@RequestParam String room) { return service.groundView(room(room)); }

    /** 내 아이템을 지금 서 있는 곳 바닥에 내려놓는다. 바닥이 가득하거나 내 것이 아니면 409. @return 이 방 바닥 목록 */
    @PostMapping("/drop")
    public List<GroundItemDTO> drop(@RequestBody(required = false) ItemRequestDTO body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        var item = valid(body);
        service.drop(member, itemId(item), item.room(), item.x(), item.y())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Cannot drop"));
        return changed(item.room());
    }

    /** 가까운(48px) 바닥 아이템을 줍는다. 멀거나 이미 주웠거나 가방이 가득하면 409. @return 이 방 바닥 목록 */
    @PostMapping("/pick")
    public List<GroundItemDTO> pick(@RequestBody(required = false) ItemRequestDTO body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        var item = valid(body);
        service.pickNear(member, itemId(item), item.room(), item.x(), item.y())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Cannot pick"));
        return changed(item.room());
    }

    private UUID member(HttpServletRequest request) {
        return auth.current(request).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required")).id();
    }

    @GetMapping
    public InventoryViewDTO view(HttpServletRequest request) { return service.view(member(request)); }

    /** 낚시에서 잡은 물고기를 가방에 넣는다. */
    @PostMapping("/fish")
    public InventoryViewDTO storeFish(@RequestBody(required = false) FishRequestDTO body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        service.storeFish(member, body == null ? null : body.species(), body == null ? null : body.cm());
        return service.view(member);
    }

    /** 로비 데스크 간식(CAKE 3원 HP +10, COFFEE 2원 피로도 +5). 가득이면 422, 동전 부족 409. */
    @PostMapping("/snack")
    public InventoryViewDTO buySnack(@RequestBody(required = false) SnackRequestDTO body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        return service.buySnack(member, body == null ? null : body.kind());
    }

    /** 포장마차에 물고기 팔기(저녁에만, 크기·어종별 1~30원). 닫혔으면 409, 내 물고기가 아니면 404. */
    @PostMapping("/sell")
    public SaleDTO sellFish(@RequestBody(required = false) SellRequestDTO body, HttpServletRequest request) {
        var member = member(request);
        limiter.check(request);
        UUID itemId;
        try { itemId = UUID.fromString(body == null || body.itemId() == null ? "" : body.itemId()); }
        catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid item"); }
        return service.sellFish(member, itemId);
    }

    /** 화분 흔들기: 5% 확률로 1~3원(서버가 추첨). 비회원은 401. */
    @PostMapping("/plant")
    public PlantResultDTO shakePlant(HttpServletRequest request) { return service.shakePlant(member(request)); }

    /** 오락실 한 판(동전 1원, HP -3, 피로도 -5). 지치면 423, 동전 부족 409. @return {"coins": 남은 동전} */
    @PostMapping("/arcade")
    public Map<String, Integer> playArcade(HttpServletRequest request) {
        return Map.of("coins", service.playArcade(member(request)));
    }
}
