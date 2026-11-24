package kr.seulgae.techlab.meeting.agendas.service.impl;

import kr.seulgae.techlab.meeting.agendas.dto.*;
import kr.seulgae.techlab.meeting.agendas.service.*;
import kr.seulgae.techlab.meeting.agendas.repository.*;
import kr.seulgae.techlab.meeting.agendas.entity.*;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.common.write.EditTokens;
import kr.seulgae.techlab.common.write.TextRules;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 회의 안건의 조회·작성·수정·삭제를 처리한다. 로그인한 작성자 또는 유효한 편집 키가 있는 작성 브라우저에서 수정·삭제할 수 있다.
 *
 * @author seulgae
 * @version 1.0, 회의 안건
 * @see "None"
 */
@Service
public class MeetingAgendaServiceImpl implements MeetingAgendaService {


    private final MeetingAgendaRepository repository;
    public MeetingAgendaServiceImpl(MeetingAgendaRepository repository) { this.repository = repository; }

    public AgendaPageDTO list(int limit, int offset) {
        var rows = repository.list(limit + 1, offset);
        return new AgendaPageDTO(rows.stream().limit(limit).toList(), rows.size() > limit);
    }

    /** @param author 로그인 회원(로그인이 꺼져 있으면 빈 값) */
    public AgendaCreatedDTO create(AgendaRequestDTO request, Optional<UUID> author) {
        var token = EditTokens.generate();
        return new AgendaCreatedDTO(repository.create(title(request), content(request), EditTokens.hash(token), author.orElse(null)), token);
    }

    public MeetingAgenda update(UUID id, AgendaRequestDTO request, String token, Optional<UUID> member) {
        authorize(id, token, member);
        return repository.update(id, title(request), content(request));
    }

    public void delete(UUID id, String token, Optional<UUID> member) {
        authorize(id, token, member);
        repository.delete(id);
    }

    /** 작성 회원 본인이거나 작성 브라우저의 수정 키가 있어야 한다. */
    private void authorize(UUID id, String token, Optional<UUID> member) {
        var owner = repository.ownership(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agenda not found"));
        if (!owner.allows(token, member)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can change this agenda");
    }

    private static String title(AgendaRequestDTO request) { return TextRules.title(request == null ? null : request.title(), TITLE_MAX, "title"); }
    private static String content(AgendaRequestDTO request) { return TextRules.content(request == null ? null : request.content(), CONTENT_MAX, "content"); }
}
