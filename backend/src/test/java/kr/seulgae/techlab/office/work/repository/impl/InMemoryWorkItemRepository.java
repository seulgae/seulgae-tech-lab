package kr.seulgae.techlab.office.work.repository.impl;

import kr.seulgae.techlab.office.work.entity.*;
import kr.seulgae.techlab.office.work.repository.*;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * DB 없는 로컬 실행·테스트용 업무 게시판 저장소. V5 공통코드 초기 데이터와 같은 코드를 쓴다.
 *
 * @author seulgae
 * @version 1.0, 사무실 업무 게시판
 * @see "None"
 */
public class InMemoryWorkItemRepository implements WorkItemRepository {
    private static final List<CommonCode> CODES = List.of(
        new CommonCode("WORK_CATEGORY", "QA", "QA", 1), new CommonCode("WORK_CATEGORY", "MAINTENANCE", "유지보수", 2), new CommonCode("WORK_CATEGORY", "OPERATION", "운영업무", 3),
        new CommonCode("WORK_STATUS", "REGISTERED", "등록", 1), new CommonCode("WORK_STATUS", "IN_PROGRESS", "조치 중", 2), new CommonCode("WORK_STATUS", "RESOLVED", "조치 완료", 3),
        new CommonCode("WORK_STATUS", "APPROVED", "최종 승인", 4), new CommonCode("WORK_STATUS", "REJECTED", "반려", 5));
    private final Map<UUID, WorkItem> items = new ConcurrentHashMap<>();
    private final AtomicLong clock = new AtomicLong();
    private final OffsetDateTime base = OffsetDateTime.parse("2026-11-17T12:00:00+09:00");
    private final Comparator<WorkItem> newest = Comparator.comparing(WorkItem::createdAt).reversed();

    @Override public List<CommonCode> codes(String group) { return CODES.stream().filter(code -> code.group().equals(group)).toList(); }
    @Override public List<WorkItem> byCategory(String category, int limit) {
        return items.values().stream().filter(item -> item.category().equals(category)).sorted(newest).limit(limit).toList();
    }
    @Override public List<WorkItem> tickets(Collection<String> statuses, int limit) {
        return items.values().stream().filter(item -> item.parentId() == null && statuses.contains(item.status())).sorted(newest).limit(limit).toList();
    }
    @Override public Optional<WorkItem> find(UUID id) { return Optional.ofNullable(items.get(id)); }
    @Override public List<WorkItem> children(UUID ticketId) {
        return items.values().stream().filter(item -> ticketId.equals(item.parentId())).sorted(Comparator.comparing(WorkItem::createdAt)).toList();
    }
    @Override public WorkItem insert(UUID parentId, String category, String status, String title, String content, String guide, UUID authorId) {
        var item = new WorkItem(UUID.randomUUID(), parentId, category, status, title, content, guide, base.plusSeconds(clock.incrementAndGet()));
        items.put(item.id(), item);
        return item;
    }
    @Override public void updateStatus(UUID ticketId, String status) {
        items.computeIfPresent(ticketId, (id, item) -> new WorkItem(id, item.parentId(), item.category(), status, item.title(), item.content(), item.guide(), item.createdAt()));
    }
}
