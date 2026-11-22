package kr.seulgae.techlab.phone;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 폰 앱 규칙: 캘린더 할 일(내 것만, 40자, 앞뒤 1년), SNS(140자, 하루 20개, 지우기는 쓴 사람·관리자).
 * @author seulgae
 * @version 1.0, 폰 앱
 * @see "None"
 */
class PhoneAppsTest {
    private final UUID me = UUID.randomUUID(), other = UUID.randomUUID();

    private static int status(Runnable call) { return assertThrows(ResponseStatusException.class, call::run).getStatusCode().value(); }

    @Test void todosBelongToTheirOwnerAndFollowTheRules() {
        var store = new InMemoryPhoneStores.Todos();
        var todos = new TodoService(store, Clock.fixed(Instant.parse("2026-11-22T03:00:00Z"), ZoneId.of("Asia/Seoul")));
        var todo = todos.add(me, "2026-11-25", "  블로그 글 쓰기 ");
        assertEquals("블로그 글 쓰기", todo.title());
        todos.add(me, "2026-12-01", "다음 달");
        assertEquals(1, todos.month(me, "2026-11").size(), "이 달 것만");
        assertEquals(0, todos.month(other, "2026-11").size(), "남의 할 일은 안 보인다");
        assertTrue(todos.done(me, todo.id(), true).done());
        assertEquals(404, status(() -> todos.done(other, todo.id(), false)), "남의 할 일은 못 바꾼다");
        assertEquals(404, status(() -> todos.delete(other, todo.id())));
        todos.delete(me, todo.id());
        assertEquals(0, todos.month(me, "2026-11").size());
        assertEquals(400, status(() -> todos.add(me, "2026-11-30", "가".repeat(41))));
        assertEquals(400, status(() -> todos.add(me, "2026-11-30", "  ")));
        assertEquals(400, status(() -> todos.add(me, "2028-01-01", "너무 먼 미래")));
        assertEquals(400, status(() -> todos.add(me, "11/30", "형식")));
        assertEquals(400, status(() -> todos.month(me, "2026-13")));
    }

    @Test void snsPostsAreLimitedAndOnlyAuthorsOrAdminsDelete() {
        var store = new InMemoryPhoneStores.Sns();
        store.addMember(me, "슬개");
        var sns = new SnsService(store);
        var post = sns.write(me, "  오늘 물고기 30cm 잡았다! ");
        assertEquals("오늘 물고기 30cm 잡았다!", post.content());
        assertEquals("슬개", post.nickname());
        assertTrue(sns.latest(me).get(0).mine());
        assertFalse(sns.latest(other).get(0).mine());
        assertFalse(sns.latest(null).get(0).mine(), "비회원도 읽을 수 있다");
        assertEquals(400, status(() -> sns.write(me, "가".repeat(141))));
        assertEquals(403, status(() -> sns.delete(other, post.id(), false)), "남의 글은 못 지운다");
        sns.delete(other, post.id(), true);
        assertEquals(404, status(() -> sns.delete(me, post.id(), false)), "관리자가 지웠다");
        for (int n = 1; n < SnsService.DAILY_POSTS; n++) sns.write(me, "글 " + n);
        sns.write(me, "스무 번째");
        assertEquals(429, status(() -> sns.write(me, "스물한 번째")), "하루 20개");
    }
}
