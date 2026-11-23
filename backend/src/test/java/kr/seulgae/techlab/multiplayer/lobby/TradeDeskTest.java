package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.multiplayer.lobby.domain.*;
import java.util.UUID;
import kr.seulgae.techlab.multiplayer.lobby.domain.TradeDesk;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 회의실 교환 신청: 받는 사람만 답하고, 60초 뒤 사라지며, 한 사람은 하나만 보내고 하나만 받는다.
 * @author seulgae
 * @version 1.0, 회의실 아이템 교환
 * @see "None"
 */
class TradeDeskTest {
    private final TradeDesk desk = new TradeDesk();
    private final UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID(), item = UUID.randomUUID();

    @Test void onlyTheReceiverCanAnswerOnce() {
        var offer = desk.offer("pa", a, "pb", b, item, 0);
        assertTrue(desk.take(offer.id(), "pa", 1).isEmpty(), "보낸 사람은 답할 수 없다");
        assertEquals(item, desk.take(offer.id(), "pb", 1).orElseThrow().itemId());
        assertTrue(desk.take(offer.id(), "pb", 2).isEmpty(), "한 번만 답한다");
    }

    @Test void offersExpireAfterSixtySeconds() {
        var offer = desk.offer("pa", a, "pb", b, item, 0);
        assertTrue(desk.take(offer.id(), "pb", TradeDesk.OFFER_TTL_NANOS + 1).isEmpty());
        assertEquals(0, desk.pending());
    }

    @Test void onePendingOfferPerPersonAndNotToSelf() {
        assertEquals("self", assertThrows(TradeDesk.Rejected.class, () -> desk.offer("pa", a, "pa", a, item, 0)).reason());
        desk.offer("pa", a, "pb", b, item, 0);
        assertEquals("sent", assertThrows(TradeDesk.Rejected.class, () -> desk.offer("pa", a, "pc", c, item, 0)).reason());
        assertEquals("busy", assertThrows(TradeDesk.Rejected.class, () -> desk.offer("pc", c, "pb", b, item, 0)).reason(), "받는 사람이 다른 신청을 보는 중");
        assertEquals(1, desk.removePlayer("pb").size(), "나가면 관련 신청을 지운다");
        desk.offer("pc", c, "pb", b, item, 0);
    }
}
