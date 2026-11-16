package kr.seulgae.techlab.meeting.agendas;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.common.write.EditTokens;
import kr.seulgae.techlab.common.write.TextRules;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 회의 안건 목록과 작성·수정·삭제 규칙을 처리한다. 작성 브라우저의 수정 키로만 바꿀 수 있다.
 *
 * @author seulgae
 * @version 1.0, 회의 안건
 * @see "None"
 */
@Service
public class MeetingAgendaService {
    /** 화이트보드 필기 영역(약 100px)에 12px 글자로 한 줄에 들어가는 길이 */
    public static final int TITLE_MAX = 8;
    public static final int CONTENT_MAX = 130;

    /**
     * 안건 요청 본문이다.
     * @param title 제목
     * @param content 내용
     * @author seulgae
     * @version 1.0, 안건 입력
     * @see "None"
     */
    public record Request(String title, String content) {}
    /**
     * 페이지 목록이다.
     * @param items 최신순 안건
     * @param hasMore 다음 페이지 여부
     * @author seulgae
     * @version 1.0, 안건 목록
     * @see "None"
     */
    public record Page(List<MeetingAgenda> items, boolean hasMore) {}
    /**
     * 생성된 안건과 작성 브라우저에만 한 번 주는 수정 키이다.
     * @param agenda 안건
     * @param editToken 수정 키
     * @author seulgae
     * @version 1.0, 작성 응답
     * @see "None"
     */
    public record Created(MeetingAgenda agenda, String editToken) {}

    private final MeetingAgendaRepository repository;
    public MeetingAgendaService(MeetingAgendaRepository repository) { this.repository = repository; }

    public Page list(int limit, int offset) {
        var rows = repository.list(limit + 1, offset);
        return new Page(rows.stream().limit(limit).toList(), rows.size() > limit);
    }

    public Created create(Request request) {
        var token = EditTokens.generate();
        return new Created(repository.create(title(request), content(request), EditTokens.hash(token)), token);
    }

    public MeetingAgenda update(UUID id, Request request, String token) {
        authorize(id, token);
        return repository.update(id, title(request), content(request));
    }

    public void delete(UUID id, String token) {
        authorize(id, token);
        repository.delete(id);
    }

    private void authorize(UUID id, String token) {
        var hash = repository.editTokenHash(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agenda not found"));
        if (!EditTokens.matches(token, hash)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author's browser can change this agenda");
    }

    private static String title(Request request) { return TextRules.title(request == null ? null : request.title(), TITLE_MAX, "title"); }
    private static String content(Request request) { return TextRules.content(request == null ? null : request.content(), CONTENT_MAX, "content"); }
}
