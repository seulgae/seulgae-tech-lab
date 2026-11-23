package kr.seulgae.techlab.inventory.repository.impl;

import kr.seulgae.techlab.inventory.dto.*;
import kr.seulgae.techlab.inventory.entity.*;
import kr.seulgae.techlab.inventory.repository.*;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * DB 없는 로컬 실행·테스트용 인벤토리 저장소
 *
 * @author seulgae
 * @version 1.0, 인벤토리(일지 #7)
 * @see "None"
 */
public class InMemoryInventoryRepository implements InventoryRepository {
    private record Owned(UUID owner, Item item) {}
    private final Map<UUID, Integer> coins = new ConcurrentHashMap<>();
    private final Map<String, Integer> today = new ConcurrentHashMap<>();
    private final Map<UUID, Owned> items = new ConcurrentHashMap<>();
    private final AtomicLong clock = new AtomicLong();
    private final OffsetDateTime base = OffsetDateTime.parse("2026-11-17T12:00:00+09:00");

    @Override public int coins(UUID member) { return coins.getOrDefault(member, 0); }

    private final Map<UUID, Vitals> vitals = new ConcurrentHashMap<>();

    @Override public Vitals vitals(UUID member) { return vitals.getOrDefault(member, new Vitals(50, 50, 50, 50)); }

    @Override public synchronized Optional<Vitals> changeVitals(UUID member, int hp, int fatigue) {
        var now = vitals(member);
        if (now.hp() + hp < 0 || now.fatigue() + fatigue < 0) return Optional.empty();
        var next = new Vitals(Math.min(now.hpMax(), now.hp() + hp), now.hpMax(), Math.min(now.fatigueMax(), now.fatigue() + fatigue), now.fatigueMax());
        vitals.put(member, next);
        return Optional.of(next);
    }

    private final java.util.List<Object[]> events = new java.util.ArrayList<>();
    private final Map<UUID, String> nicknames = new ConcurrentHashMap<>();

    /** 테스트·로컬용 회원(송금 받을 사람) */
    public void addMember(UUID id, String nickname) { nicknames.put(id, nickname); }

    @Override public synchronized Optional<Integer> changeCoins(UUID member, int amount, String reason, UUID counterpart) {
        int next = coins(member) + amount;
        if (next < 0) return Optional.empty();
        coins.put(member, next);
        today.merge(member + reason, 1, Integer::sum);
        events.add(new Object[]{UUID.randomUUID(), member, amount, reason, counterpart, base.plusSeconds(clock.incrementAndGet())});
        return Optional.of(next);
    }

    @Override public synchronized List<CoinHistory> history(UUID member, int limit) {
        return events.stream().filter(e -> member.equals(e[1])).sorted(Comparator.comparing((Object[] e) -> (OffsetDateTime) e[5]).reversed()).limit(limit)
            .map(e -> new CoinHistory((UUID) e[0], (int) e[2], (String) e[3], (String) e[3], e[4] == null ? null : nicknames.get((UUID) e[4]), (OffsetDateTime) e[5]))
            .toList();
    }

    @Override public List<RecipientDTO> recipients(String query, UUID exclude, int limit) {
        return nicknames.entrySet().stream().filter(e -> !e.getKey().equals(exclude) && e.getValue().toLowerCase().contains(query.toLowerCase()))
            .map(e -> new RecipientDTO(e.getKey(), e.getValue())).sorted(Comparator.comparing(RecipientDTO::nickname)).limit(limit).toList();
    }

    @Override public Optional<String> nickname(UUID member) { return Optional.ofNullable(nicknames.get(member)); }

    @Override public int countToday(UUID member, String reason) { return today.getOrDefault(member + reason, 0); }

    @Override public List<Item> owned(UUID member) {
        return items.values().stream().filter(owned -> member.equals(owned.owner())).map(Owned::item)
            .sorted(Comparator.comparing(Item::createdAt).reversed()).toList();
    }

    @Override public Item add(UUID member, String kind, String name, Integer sizeCm) {
        var item = new Item(UUID.randomUUID(), kind, name, sizeCm, null, null, null, base.plusSeconds(clock.incrementAndGet()));
        items.put(item.id(), new Owned(member, item));
        return item;
    }

    @Override public synchronized Optional<Item> drop(UUID member, UUID itemId, String roomId, double x, double y) {
        var owned = items.get(itemId);
        if (owned == null || !member.equals(owned.owner())) return Optional.empty();
        var i = owned.item();
        var dropped = new Item(i.id(), i.kind(), i.name(), i.sizeCm(), roomId, x, y, i.createdAt());
        items.put(itemId, new Owned(null, dropped));
        return Optional.of(dropped);
    }

    @Override public synchronized int remove(UUID member, UUID itemId) {
        var owned = items.get(itemId);
        if (owned == null || !member.equals(owned.owner())) return 0;
        items.remove(itemId);
        return 1;
    }

    @Override public synchronized int swap(UUID a, UUID itemA, UUID b, UUID itemB) {
        var first = items.get(itemA);
        var second = items.get(itemB);
        int matched = (first != null && a.equals(first.owner()) ? 1 : 0) + (second != null && b.equals(second.owner()) ? 1 : 0);
        if (matched != 2) return matched;
        items.put(itemA, new Owned(b, first.item()));
        items.put(itemB, new Owned(a, second.item()));
        return 2;
    }

    @Override public List<Item> ground(String roomId) {
        return items.values().stream().filter(owned -> owned.owner() == null && roomId.equals(owned.item().roomId())).map(Owned::item).toList();
    }

    @Override public synchronized Optional<Item> pick(UUID member, UUID itemId, String roomId) {
        var owned = items.get(itemId);
        if (owned == null || owned.owner() != null || !roomId.equals(owned.item().roomId())) return Optional.empty();
        var i = owned.item();
        var picked = new Item(i.id(), i.kind(), i.name(), i.sizeCm(), null, null, null, i.createdAt());
        items.put(itemId, new Owned(member, picked));
        return Optional.of(picked);
    }
}
