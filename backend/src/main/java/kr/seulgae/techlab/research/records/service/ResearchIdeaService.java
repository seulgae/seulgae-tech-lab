package kr.seulgae.techlab.research.records.service;

import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.common.write.EditTokens;
import kr.seulgae.techlab.common.write.TextRules;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.IdeaRequest;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로비 컴퓨터의 연구 아이디어 일지 작성·수정·삭제를 처리한다.
 * 로그인이 없으므로 작성할 때 발급한 수정 키를 가진 브라우저만 수정·삭제할 수 있다.
 *
 * @author seulgae
 * @version 1.0, 아이디어 일지 쓰기
 * @see "None"
 */
@Service
public class ResearchIdeaService {
    public static final int TITLE_MAX = 40;
    public static final int CONTENT_MAX = 130;

    /**
     * 생성된 기록과 작성 브라우저에만 한 번 돌려주는 수정 키이다.
     * @author seulgae
     * @version 1.0, 작성 응답
     * @see "None"
     */
    public record Created(ResearchRecord record, String editToken) {}

    private final ResearchRepository repository;
    public ResearchIdeaService(ResearchRepository repository) { this.repository = repository; }

    /** @return 다음 일지 번호. 화면이 "연구 아이디어 일지 #N" 제목을 미리 채운다. */
    public int nextNumber() { return repository.nextIdeaNumber(); }

    /** @param author 로그인 회원(로그인이 꺼져 있으면 빈 값) */
    public Created create(IdeaRequest request, Optional<UUID> author) {
        var token = EditTokens.generate();
        var record = repository.createIdea(title(request), content(request), EditTokens.hash(token), author.orElse(null));
        return new Created(record, token);
    }

    public ResearchRecord update(UUID id, IdeaRequest request, String token, Optional<UUID> member) {
        authorize(id, token, member);
        return repository.updateIdea(id, title(request), content(request));
    }

    public void delete(UUID id, String token, Optional<UUID> member) {
        authorize(id, token, member);
        repository.delete(id);
    }

    /** 없는 기록은 404, 작성 회원도 아니고 수정 키도 맞지 않으면(V1 기록 포함) 403 */
    private void authorize(UUID id, String token, Optional<UUID> member) {
        var owner = repository.ownership(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Research record not found"));
        if (!owner.allows(token, member)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can change this record");
    }

    private static String title(IdeaRequest request) { return TextRules.title(request == null ? null : request.title(), TITLE_MAX, "title"); }
    private static String content(IdeaRequest request) { return TextRules.content(request == null ? null : request.content(), CONTENT_MAX, "content"); }
}
