package kr.seulgae.techlab.dorm.repository.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.dorm.entity.Furniture;
import kr.seulgae.techlab.dorm.entity.MemberFurniture;
import kr.seulgae.techlab.dorm.repository.DormRepository;

/**
 * DB 없는 로컬 실행·테스트용 개인 기숙사 가구 저장소(V19 시드와 같은 카탈로그).
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
public class InMemoryDormRepository implements DormRepository {
    private record Row(UUID member, MemberFurniture item) {}
    private static final List<Furniture> CATALOG = List.of(
        new Furniture("BED", "침대", 25, 92, 56, true), new Furniture("DESK", "책상", 15, 112, 40, true),
        new Furniture("COMPUTER", "컴퓨터 책상", 22, 112, 40, true), new Furniture("CHAIR", "의자", 5, 28, 24, true),
        new Furniture("ARMCHAIR", "안락의자", 9, 32, 24, true), new Furniture("SOFA", "소파", 18, 104, 40, true),
        new Furniture("BOOKSHELF", "책장", 12, 56, 28, true), new Furniture("PLANT", "화분", 4, 28, 20, true),
        new Furniture("TALL_PLANT", "큰 화분", 7, 28, 20, true), new Furniture("LAMP", "스탠드 조명", 6, 20, 16, true),
        new Furniture("WHITEBOARD", "화이트보드", 10, 104, 24, true), new Furniture("COFFEE_MACHINE", "커피 머신", 14, 28, 20, true),
        new Furniture("ARCADE", "오락기", 30, 56, 32, true), new Furniture("RUG", "러그", 6, 96, 64, false));
    private final List<Row> rows = new ArrayList<>();

    @Override public List<Furniture> catalog() { return CATALOG; }

    @Override public synchronized List<MemberFurniture> owned(UUID member) {
        return rows.stream().filter(row -> row.member().equals(member)).map(Row::item).toList();
    }

    @Override public synchronized MemberFurniture add(UUID member, String code) {
        var item = new MemberFurniture(UUID.randomUUID(), code, false, null, null);
        rows.add(new Row(member, item));
        return item;
    }

    @Override public synchronized Optional<MemberFurniture> place(UUID member, UUID id, int x, int y) { return replace(member, id, true, x, y); }

    @Override public synchronized Optional<MemberFurniture> store(UUID member, UUID id) { return replace(member, id, false, null, null); }

    private Optional<MemberFurniture> replace(UUID member, UUID id, boolean placed, Integer x, Integer y) {
        for (int i = 0; i < rows.size(); i++) {
            Row row = rows.get(i);
            if (!row.member().equals(member) || !row.item().id().equals(id)) continue;
            var next = new MemberFurniture(id, row.item().code(), placed, x, y);
            rows.set(i, new Row(member, next));
            return Optional.of(next);
        }
        return Optional.empty();
    }
}
