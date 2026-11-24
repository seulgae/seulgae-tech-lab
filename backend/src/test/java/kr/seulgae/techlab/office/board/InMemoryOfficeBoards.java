package kr.seulgae.techlab.office.board;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import kr.seulgae.techlab.office.idea.entity.IdeaPost;
import kr.seulgae.techlab.office.idea.repository.IdeaPostRepository;
import kr.seulgae.techlab.office.qa.entity.QaTicket;
import kr.seulgae.techlab.office.qa.repository.QaTicketRepository;

/**
 * DB 없는 로컬 실행·테스트용 아이디어 기획·QA 게시판 저장소.
 *
 * @author 길태형
 * @version 1.0, 게시판 개편
 * @see None
 */
public final class InMemoryOfficeBoards {
    private static final OffsetDateTime BASE = OffsetDateTime.parse("2026-11-24T09:00:00+09:00");
    private static final Map<String, String> STATUS_NAMES = Map.of("REGISTERED", "등록", "IN_PROGRESS", "조치 중", "RESOLVED", "조치 완료");

    private InMemoryOfficeBoards() {}

    /** 아이디어 글(쓴 순서대로 1초씩 늦은 시각) */
    public static final class Ideas implements IdeaPostRepository {
        private final List<IdeaPost> posts = new ArrayList<>();
        private final AtomicLong clock = new AtomicLong();

        @Override public synchronized List<IdeaPost> recent(int limit) {
            return posts.stream().sorted(Comparator.comparing(IdeaPost::createdAt).reversed()).limit(limit).toList();
        }

        @Override public synchronized IdeaPost create(UUID author, String title, String content) {
            var post = new IdeaPost(UUID.randomUUID(), title, content, author == null ? null : "연구원", BASE.plusSeconds(clock.incrementAndGet()));
            posts.add(post);
            return post;
        }
    }

    /** QA 티켓 */
    public static final class Tickets implements QaTicketRepository {
        private final List<QaTicket> tickets = new ArrayList<>();
        private final AtomicLong clock = new AtomicLong();

        @Override public synchronized List<QaTicket> recent(int limit) {
            return tickets.stream().sorted(Comparator.comparing(QaTicket::createdAt).reversed()).limit(limit).toList();
        }

        @Override public synchronized Optional<QaTicket> find(UUID id) { return tickets.stream().filter(ticket -> ticket.id().equals(id)).findFirst(); }

        @Override public synchronized UUID create(UUID author, String title, String content) {
            var ticket = new QaTicket(UUID.randomUUID(), title, content, "REGISTERED", STATUS_NAMES.get("REGISTERED"), author == null ? null : "연구원",
                BASE.plusSeconds(clock.incrementAndGet()), null);
            tickets.add(ticket);
            return ticket.id();
        }

        @Override public synchronized boolean move(UUID id, String from, String to) {
            for (int i = 0; i < tickets.size(); i++) {
                var ticket = tickets.get(i);
                if (!ticket.id().equals(id) || !ticket.status().equals(from)) continue;
                tickets.set(i, new QaTicket(id, ticket.title(), ticket.content(), to, STATUS_NAMES.get(to), ticket.author(), ticket.createdAt(),
                    BASE.plusSeconds(clock.incrementAndGet())));
                return true;
            }
            return false;
        }
    }
}
