package kr.seulgae.techlab.savings.repository.impl;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import kr.seulgae.techlab.savings.entity.Savings;
import kr.seulgae.techlab.savings.repository.SavingsRepository;

/**
 * DB 없는 로컬 실행·테스트용 적금 저장소.
 *
 * @author 길태형
 * @version 1.0, 은행 적금
 * @see None
 */
public class InMemorySavingsRepository implements SavingsRepository {
    private record Row(UUID member, Savings item) {}
    private final List<Row> rows = new ArrayList<>();

    @Override public synchronized List<Savings> list(UUID member, int closedLimit) {
        var mine = rows.stream().filter(row -> row.member().equals(member)).map(Row::item).toList();
        var open = mine.stream().filter(item -> item.closedAt() == null);
        var closed = mine.stream().filter(item -> item.closedAt() != null).sorted(Comparator.comparing(Savings::closedAt).reversed()).limit(closedLimit);
        return Stream.concat(open, closed).sorted(Comparator.comparing(Savings::createdAt).reversed()).toList();
    }

    @Override public synchronized int openCount(UUID member) {
        return (int) rows.stream().filter(row -> row.member().equals(member) && row.item().closedAt() == null).count();
    }

    @Override public synchronized Savings create(UUID member, int principal, int termDays, int ratePct, OffsetDateTime createdAt, OffsetDateTime maturesAt) {
        var item = new Savings(UUID.randomUUID(), principal, termDays, ratePct, createdAt, maturesAt, null, null);
        rows.add(new Row(member, item));
        return item;
    }

    @Override public synchronized Optional<Savings> find(UUID member, UUID id) {
        return rows.stream().filter(row -> row.member().equals(member) && row.item().id().equals(id)).map(Row::item).findFirst();
    }

    @Override public synchronized boolean close(UUID member, UUID id, int payout, OffsetDateTime closedAt) {
        for (int i = 0; i < rows.size(); i++) {
            var row = rows.get(i);
            if (!row.member().equals(member) || !row.item().id().equals(id) || row.item().closedAt() != null) continue;
            var item = row.item();
            rows.set(i, new Row(member, new Savings(item.id(), item.principal(), item.termDays(), item.ratePct(), item.createdAt(), item.maturesAt(), closedAt, payout)));
            return true;
        }
        return false;
    }
}
