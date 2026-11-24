package kr.seulgae.techlab.dorm.service.impl;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.dorm.dto.DormViewDTO;
import kr.seulgae.techlab.dorm.dto.RestDTO;
import kr.seulgae.techlab.dorm.entity.Furniture;
import kr.seulgae.techlab.dorm.entity.MemberFurniture;
import kr.seulgae.techlab.dorm.repository.DormRepository;
import kr.seulgae.techlab.dorm.service.DormService;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.rule.entity.ActionCost;
import kr.seulgae.techlab.rule.entity.GameValue;
import kr.seulgae.techlab.rule.service.GameRules;
import kr.seulgae.techlab.rule.service.VitalsGate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 개인 기숙사 가구 규칙 구현.
 * 배치 규칙: 바닥(가구 크기)이 벽 안쪽이어야 하고, 문 앞을 막지 않으며, 부딪히는 가구끼리는 겹치지 않는다(러그는 아무 데나).
 * 화면도 같은 규칙으로 미리 보여 주지만, 실제 판정은 서버가 한다.
 * 가구를 놓을 때 HP가 들고(FURNITURE_PLACE), 놓인 침대에서 쉬면 일정 간격마다 HP·기력이 오른다(tb_lab_game_rule REST_*).
 *
 * @author 길태형
 * @version 1.1, 가구 배치 비용과 침대 휴식
 * @see "None"
 */
@Service
public class DormServiceImpl implements DormService {
    private final DormRepository dorm;
    private final InventoryRepository inventory;
    private final VitalsGate gate;
    private final GameRules rules;
    private final Clock clock;

    @Autowired
    public DormServiceImpl(DormRepository dorm, InventoryRepository inventory, VitalsGate gate, GameRules rules) { this(dorm, inventory, gate, rules, Clock.systemDefaultZone()); }

    public DormServiceImpl(DormRepository dorm, InventoryRepository inventory) { this(dorm, inventory, VitalsGate.defaults(inventory), GameRules.defaults(), Clock.systemDefaultZone()); }

    public DormServiceImpl(DormRepository dorm, InventoryRepository inventory, VitalsGate gate, GameRules rules, Clock clock) {
        this.dorm = dorm; this.inventory = inventory; this.gate = gate; this.rules = rules; this.clock = clock;
    }

    @Override
    public DormViewDTO view(UUID member) {
        return new DormViewDTO(inventory.coins(member), dorm.catalog(), dorm.owned(member));
    }

    @Override
    @Transactional
    public DormViewDTO buy(UUID member, String code) {
        Furniture furniture = find(code);
        if (dorm.owned(member).size() >= MAX_FURNITURE) throw new ResponseStatusException(HttpStatus.CONFLICT, "Too much furniture");
        /* 동전부터 뺀다: 모자라면 아무것도 바꾸지 않는다(잔액 ≥ 0 조건의 UPDATE). */
        inventory.changeCoins(member, -furniture.price(), FURNITURE_BUY)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Not enough coins"));
        dorm.add(member, furniture.code());
        return view(member);
    }

    @Override
    @Transactional
    public DormViewDTO place(UUID member, UUID id, Integer x, Integer y) {
        if (x == null || y == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Position required");
        List<MemberFurniture> owned = dorm.owned(member);
        MemberFurniture target = owned.stream().filter(item -> item.id().equals(id)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Furniture not found"));
        List<Furniture> catalog = dorm.catalog();
        Furniture shape = shapeOf(catalog, target.code());
        if (!fits(shape, x, y)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Outside floor or blocks the door");
        /* 부딪히는 가구끼리만 겹침을 막는다(자기 자신은 옮기는 중이므로 뺀다). */
        if (shape.blocking()) for (MemberFurniture other : owned) {
            if (!other.placed() || other.id().equals(id)) continue;
            Furniture otherShape = shapeOf(catalog, other.code());
            if (otherShape.blocking() && overlaps(shape, x, y, otherShape, other.x(), other.y()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Overlaps other furniture");
        }
        gate.ensureFit(member, ActionCost.FURNITURE_PLACE);
        dorm.place(member, id, x, y).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Furniture not found"));
        gate.spend(member, ActionCost.FURNITURE_PLACE);
        return view(member);
    }

    @Override
    @Transactional
    public RestDTO rest(UUID member) {
        if (dorm.owned(member).stream().noneMatch(item -> item.placed() && BED.equals(item.code())))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Place a bed first");
        int every = Math.max(1, rules.value(GameValue.REST_EVERY_SEC));
        int hp = rules.value(GameValue.REST_HP), fatigue = rules.value(GameValue.REST_FATIGUE);
        boolean unlimited = rules.rankOf(inventory.workCount(member)).unlimited();
        /* 간격 확인과 회복을 조건부 UPDATE 한 번으로: 여러 탭에서 동시에 불러도 한 번만 오른다 */
        OffsetDateTime now = OffsetDateTime.now(clock);
        var recovered = inventory.rest(member, hp, fatigue, now, now.minusSeconds(every));
        var vitals = recovered.orElseGet(() -> inventory.vitals(member));
        return new RestDTO(recovered.isPresent(), vitals.hp(), vitals.hpMax(), vitals.fatigue(), vitals.fatigueMax(), every, hp, fatigue, unlimited);
    }

    @Override
    @Transactional
    public DormViewDTO store(UUID member, UUID id) {
        dorm.store(member, id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Furniture not found"));
        return view(member);
    }

    /**
     * 가구 바닥이 벽 안쪽이고 문 앞을 막지 않는지 본다.
     *
     * @param shape 가구 모양
     * @param x 바닥 가운데 x
     * @param y 바닥 아래 끝 y
     * @return 놓을 수 있으면 true
     */
    public static boolean fits(Furniture shape, int x, int y) {
        int left = x - shape.width() / 2, right = x + shape.width() / 2, top = y - shape.height();
        if (left < FLOOR_LEFT || right > FLOOR_RIGHT || top < FLOOR_TOP || y > FLOOR_BOTTOM) return false;
        boolean doorBlocked = right > DOOR_LEFT && left < DOOR_RIGHT && y > DOOR_TOP;
        return !shape.blocking() || !doorBlocked;
    }

    /**
     * 두 가구의 바닥 사각형이 겹치는지 본다.
     *
     * @param a 첫 가구 모양
     * @param ax 첫 가구 x
     * @param ay 첫 가구 y
     * @param b 둘째 가구 모양
     * @param bx 둘째 가구 x
     * @param by 둘째 가구 y
     * @return 겹치면 true
     */
    public static boolean overlaps(Furniture a, int ax, int ay, Furniture b, int bx, int by) {
        return Math.abs(ax - bx) * 2 < a.width() + b.width() && ay - a.height() < by && by - b.height() < ay;
    }

    private Furniture find(String code) {
        return dorm.catalog().stream().filter(item -> item.code().equals(code)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown furniture"));
    }

    private static Furniture shapeOf(List<Furniture> catalog, String code) {
        return catalog.stream().filter(item -> item.code().equals(code)).findFirst().orElseThrow();
    }
}
