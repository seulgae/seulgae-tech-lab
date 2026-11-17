package kr.seulgae.techlab.lobby.guestbook;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로비 방명록: 들어오는 사람이 짧은 인사를 남긴다. 제목 8자, 내용 130자(앞뒤 공백 제외, 글자 단위).
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
@Service
public class GuestbookService {
    /** 공통코드 BOARD_CATEGORY의 방명록 카테고리 */
    public static final String GUESTBOOK = "GUESTBOOK";
    public static final int TITLE_MAX = 8;
    public static final int CONTENT_MAX = 130;
    static final int LIST_LIMIT = 50;

    private final GuestbookStore store;

    public GuestbookService(GuestbookStore store) { this.store = store; }

    public List<GuestbookStore.Entry> latest() { return store.latest(GUESTBOOK, LIST_LIMIT); }

    public GuestbookStore.Entry write(String title, String content, UUID author) {
        return store.insert(GUESTBOOK, text(title, TITLE_MAX, "title"), text(content, CONTENT_MAX, "content"), author);
    }

    private static String text(String value, int max, String field) {
        String stripped = value == null ? "" : value.strip();
        if (stripped.isEmpty() || stripped.codePointCount(0, stripped.length()) > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be 1-" + max + " characters");
        }
        return stripped;
    }
}
