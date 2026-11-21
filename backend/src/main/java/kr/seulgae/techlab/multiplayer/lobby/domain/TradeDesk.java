package kr.seulgae.techlab.multiplayer.lobby.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 회의실 아이템 교환 신청 대기열. 신청은 60초 뒤 사라지고, 한 사람은 한 번에 하나만 보내고 하나만 받을 수 있다.
 * 실제 아이템 교환(소유자 맞바꾸기)은 인벤토리 서비스가 한 트랜잭션으로 한다.
 *
 * @author seulgae
 * @version 1.0, 회의실 아이템 교환
 * @see "None"
 */
public class TradeDesk {
    public static final long OFFER_TTL_NANOS = 60_000_000_000L;

    /**
     * 교환 신청
     * @param id 신청 id
     * @param fromPlayer 보낸 연결의 플레이어 id
     * @param fromMember 보낸 회원
     * @param toPlayer 받는 플레이어 id
     * @param toMember 받는 회원
     * @param itemId 보낸 사람이 내놓은 아이템
     * @param createdAt 신청 시각(nanoTime)
     */
    public record Offer(String id, String fromPlayer, UUID fromMember, String toPlayer, UUID toMember, UUID itemId, long createdAt) {}

    /** 신청할 수 없는 이유(화면 안내 코드) */
    public static final class Rejected extends RuntimeException {
        private final String reason;
        public Rejected(String reason) { super(reason, null, false, false); this.reason = reason; }
        public String reason() { return reason; }
    }

    private final Map<String, Offer> offers = new LinkedHashMap<>();

    /**
     * 교환을 신청한다.
     * @throws Rejected self(나에게), sent(이미 보낸 신청이 있음), busy(상대가 다른 신청을 보는 중)
     */
    public synchronized Offer offer(String fromPlayer, UUID fromMember, String toPlayer, UUID toMember, UUID itemId, long now) {
        expire(now);
        if (fromPlayer.equals(toPlayer) || fromMember.equals(toMember)) throw new Rejected("self");
        if (offers.values().stream().anyMatch(offer -> offer.fromPlayer().equals(fromPlayer))) throw new Rejected("sent");
        if (offers.values().stream().anyMatch(offer -> offer.toPlayer().equals(toPlayer) || offer.fromPlayer().equals(toPlayer))) throw new Rejected("busy");
        var offer = new Offer(UUID.randomUUID().toString(), fromPlayer, fromMember, toPlayer, toMember, itemId, now);
        offers.put(offer.id(), offer);
        return offer;
    }

    /** 받는 사람이 답하면 신청을 꺼낸다. 없거나, 만료됐거나, 받는 사람이 아니면 빈 값 */
    public synchronized Optional<Offer> take(String tradeId, String byPlayer, long now) {
        expire(now);
        var offer = offers.get(tradeId);
        if (offer == null || !offer.toPlayer().equals(byPlayer)) return Optional.empty();
        offers.remove(tradeId);
        return Optional.of(offer);
    }

    /** 연결이 끊긴 사람이 보냈거나 받은 신청을 지우고 돌려준다(상대에게 알리기 위해). */
    public synchronized List<Offer> removePlayer(String playerId) {
        List<Offer> removed = new ArrayList<>();
        offers.values().removeIf(offer -> {
            boolean involved = offer.fromPlayer().equals(playerId) || offer.toPlayer().equals(playerId);
            if (involved) removed.add(offer);
            return involved;
        });
        return removed;
    }

    public synchronized int pending() { return offers.size(); }

    private void expire(long now) { offers.values().removeIf(offer -> now - offer.createdAt() > OFFER_TTL_NANOS); }
}
