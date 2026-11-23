package kr.seulgae.techlab.dorm.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import kr.seulgae.techlab.dorm.repository.impl.InMemoryDormRepository;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/**
 * 개인 기숙사 가구: 구매(동전), 배치 규칙(벽·문 앞·겹침), 보관, 남의 가구 차단.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
class DormServiceTest {
    private final InMemoryInventoryRepository inventory = new InMemoryInventoryRepository();
    private final DormServiceImpl service = new DormServiceImpl(new InMemoryDormRepository(), inventory);
    private final UUID me = UUID.randomUUID();

    private UUID buy(String code) {
        var view = service.buy(me, code);
        return view.furniture().get(view.furniture().size() - 1).id();
    }

    @Test
    void buyingTakesCoinsAndPutsFurnitureInStorage() {
        inventory.changeCoins(me, 30, "TEST");
        var view = service.buy(me, "DESK");
        assertThat(view.coins()).isEqualTo(15);
        assertThat(view.furniture()).singleElement().satisfies(item -> assertThat(item.placed()).isFalse());
    }

    @Test
    void notEnoughCoinsOrUnknownFurnitureIsRefused() {
        inventory.changeCoins(me, 3, "TEST");
        assertThatThrownBy(() -> service.buy(me, "BED")).hasMessageContaining("409");
        assertThatThrownBy(() -> service.buy(me, "NOPE")).hasMessageContaining("404");
        assertThat(service.view(me).coins()).isEqualTo(3);
    }

    @Test
    void placeRespectsWallsDoorAndOtherFurniture() {
        inventory.changeCoins(me, 100, "TEST");
        UUID desk = buy("DESK"), bed = buy("BED"), rug = buy("RUG");
        assertThatThrownBy(() -> service.place(me, desk, 30, 200)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.place(me, desk, 400, 560)).hasMessageContaining("door");
        service.place(me, desk, 200, 200);
        assertThatThrownBy(() -> service.place(me, bed, 220, 210)).hasMessageContaining("Overlaps");
        service.place(me, rug, 200, 220);
        service.place(me, desk, 210, 200);
        assertThat(service.view(me).furniture()).filteredOn(item -> item.placed()).hasSize(2);
    }

    @Test
    void storeReturnsFurnitureAndOthersCannotTouchIt() {
        inventory.changeCoins(me, 10, "TEST");
        UUID plant = buy("PLANT");
        service.place(me, plant, 600, 300);
        assertThatThrownBy(() -> service.place(UUID.randomUUID(), plant, 500, 300)).hasMessageContaining("404");
        assertThatThrownBy(() -> service.store(UUID.randomUUID(), plant)).hasMessageContaining("404");
        var view = service.store(me, plant);
        assertThat(view.furniture().get(0).placed()).isFalse();
        assertThat(view.furniture().get(0).x()).isNull();
    }
}
