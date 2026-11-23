package kr.seulgae.techlab.phone.repository.impl;

import kr.seulgae.techlab.phone.entity.*;
import kr.seulgae.techlab.phone.repository.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * DB 없는 로컬 실행·테스트용 폰 앱 저장소(할 일, SNS)
 *
 * @author seulgae
 * @version 1.0, 폰 앱
 * @see "None"
 */
public final class InMemoryPhoneRepositories {
    private InMemoryPhoneRepositories() {}
    private static final OffsetDateTime BASE = OffsetDateTime.parse("2026-11-22T09:00:00+09:00");

    public static class Todos implements TodoRepository {
        private record Row(UUID member, Todo todo) {}
        private final Map<UUID, Row> rows = new ConcurrentHashMap<>();
        private final AtomicLong clock = new AtomicLong();

        @Override public List<Todo> between(UUID member, LocalDate from, LocalDate to) {
            return rows.values().stream().filter(row -> row.member().equals(member)).map(Row::todo)
                .filter(todo -> !todo.date().isBefore(from) && !todo.date().isAfter(to))
                .sorted(Comparator.comparing(Todo::date).thenComparing(Todo::createdAt)).toList();
        }
        @Override public int count(UUID member) { return (int) rows.values().stream().filter(row -> row.member().equals(member)).count(); }
        @Override public Todo insert(UUID member, LocalDate date, String title) {
            var todo = new Todo(UUID.randomUUID(), date, title, false, BASE.plusSeconds(clock.incrementAndGet()));
            rows.put(todo.id(), new Row(member, todo));
            return todo;
        }
        @Override public synchronized Optional<Todo> setDone(UUID member, UUID id, boolean done) {
            var row = rows.get(id);
            if (row == null || !row.member().equals(member)) return Optional.empty();
            var t = row.todo();
            var next = new Todo(t.id(), t.date(), t.title(), done, t.createdAt());
            rows.put(id, new Row(member, next));
            return Optional.of(next);
        }
        @Override public synchronized int delete(UUID member, UUID id) {
            var row = rows.get(id);
            if (row == null || !row.member().equals(member)) return 0;
            rows.remove(id);
            return 1;
        }
    }

    public static class Sns implements SnsRepository {
        private final Map<UUID, SnsPost> posts = new ConcurrentHashMap<>();
        private final Map<UUID, String> nicknames = new ConcurrentHashMap<>();
        private final AtomicLong clock = new AtomicLong();

        public void addMember(UUID id, String nickname) { nicknames.put(id, nickname); }

        @Override public List<SnsPost> latest(int limit) {
            return posts.values().stream().sorted(Comparator.comparing(SnsPost::createdAt).reversed()).limit(limit).toList();
        }
        @Override public SnsPost insert(UUID author, String content) {
            var post = new SnsPost(UUID.randomUUID(), author, nicknames.getOrDefault(author, "연구원"), content, BASE.plusSeconds(clock.incrementAndGet()));
            posts.put(post.id(), post);
            return post;
        }
        @Override public int countToday(UUID author) { return (int) posts.values().stream().filter(post -> post.authorId().equals(author)).count(); }
        @Override public Optional<UUID> author(UUID id) { return Optional.ofNullable(posts.get(id)).map(SnsPost::authorId); }
        @Override public int delete(UUID id) { return posts.remove(id) == null ? 0 : 1; }
    }
}
