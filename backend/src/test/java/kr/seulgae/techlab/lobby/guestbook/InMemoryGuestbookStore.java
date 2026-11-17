package kr.seulgae.techlab.lobby.guestbook;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * 테스트·DB 없는 로컬 실행용 방명록 저장소.
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
public class InMemoryGuestbookStore implements GuestbookStore {
    private final List<Entry> entries = new ArrayList<>();
    private OffsetDateTime clock = OffsetDateTime.parse("2026-11-17T10:00:00Z");

    @Override public synchronized List<Entry> latest(String category, int limit) {
        return entries.stream().filter(entry -> entry.category().equals(category))
            .sorted(Comparator.comparing(Entry::createdAt).reversed()).limit(limit).toList();
    }

    @Override public synchronized Entry insert(String category, String title, String content, UUID authorId) {
        clock = clock.plusSeconds(1);
        var entry = new Entry(UUID.randomUUID(), category, title, content, authorId == null ? null : "회원", clock);
        entries.add(entry);
        return entry;
    }
}
