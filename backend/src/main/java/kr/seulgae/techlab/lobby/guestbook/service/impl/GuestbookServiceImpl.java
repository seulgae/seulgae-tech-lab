package kr.seulgae.techlab.lobby.guestbook.service.impl;

import kr.seulgae.techlab.lobby.guestbook.entity.*;
import kr.seulgae.techlab.lobby.guestbook.service.*;
import kr.seulgae.techlab.lobby.guestbook.repository.*;
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
public class GuestbookServiceImpl implements GuestbookService {
    static final int LIST_LIMIT = 50;

    private final GuestbookRepository store;

    public GuestbookServiceImpl(GuestbookRepository store) { this.store = store; }

    public List<Guestbook> latest() { return store.latest(GUESTBOOK, LIST_LIMIT); }

    public Guestbook write(String title, String content, UUID author) {
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
