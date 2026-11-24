package kr.seulgae.techlab.office.idea.service.impl;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.office.idea.entity.IdeaPost;
import kr.seulgae.techlab.office.idea.repository.IdeaPostRepository;
import kr.seulgae.techlab.office.idea.service.IdeaPostService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 아이디어 기획 게시판 구현: 앞뒤 공백을 지우고 길이를 확인한 뒤 저장한다.
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see None
 */
@Service
public class IdeaPostServiceImpl implements IdeaPostService {
    private final IdeaPostRepository posts;

    public IdeaPostServiceImpl(IdeaPostRepository posts) { this.posts = posts; }

    @Override public List<IdeaPost> list() { return posts.recent(LIST_LIMIT); }

    @Override public IdeaPost create(String title, String content, UUID author) {
        return posts.create(author, text(title, TITLE_MAX, "title"), text(content, CONTENT_MAX, "content"));
    }

    /**
     * 공백을 다듬고 1~max자인지 확인한다.
     *
     * @param value 입력
     * @param max 최대 글자 수
     * @param field 필드 이름(오류 문구)
     * @return 다듬은 값
     * @exception ResponseStatusException 비었거나 너무 길면 400
     */
    static String text(String value, int max, String field) {
        String trimmed = value == null ? "" : value.strip();
        if (trimmed.isEmpty() || trimmed.codePointCount(0, trimmed.length()) > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be 1-" + max + " characters");
        return trimmed;
    }
}
