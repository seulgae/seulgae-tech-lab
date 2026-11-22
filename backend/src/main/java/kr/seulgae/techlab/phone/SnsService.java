package kr.seulgae.techlab.phone;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 폰 SNS 규칙: 글 1~140자, 회원당 하루 20개(도배 방지). 글은 누구나 읽고, 지우기는 쓴 사람과 관리자만.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(SNS)
 * @see "None"
 */
@Service
public class SnsService {
    public static final int CONTENT_MAX = 140, DAILY_POSTS = 20, LIST_LIMIT = 50;

    /** 화면용 글: 작성자 id 대신 "내 글"인지만 알려 준다. */
    public record View(UUID id, String nickname, String content, OffsetDateTime createdAt, boolean mine) {}

    private final SnsStore store;

    public SnsService(SnsStore store) { this.store = store; }

    public List<View> latest(UUID viewer) {
        return store.latest(LIST_LIMIT).stream().map(post -> view(post, viewer)).toList();
    }

    public View write(UUID author, String content) {
        String text = content == null ? "" : content.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > CONTENT_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content must be 1-" + CONTENT_MAX + " characters");
        if (store.countToday(author) >= DAILY_POSTS) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily post limit");
        return view(store.insert(author, text), author);
    }

    /** 글 지우기. 없으면 404, 내 글이 아니고 관리자도 아니면 403 */
    public void delete(UUID member, UUID id, boolean admin) {
        var author = store.author(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        if (!author.equals(member) && !admin) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your post");
        store.delete(id);
    }

    private static View view(SnsStore.Post post, UUID viewer) {
        return new View(post.id(), post.nickname(), post.content(), post.createdAt(), post.authorId().equals(viewer));
    }
}
