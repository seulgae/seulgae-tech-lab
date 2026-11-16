package kr.seulgae.techlab.meeting.agendas;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.common.write.EditTokens;
import kr.seulgae.techlab.common.write.Ownership;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.dto.IdeaRequest;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import kr.seulgae.techlab.research.records.service.ResearchIdeaService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 회의 안건과 연구 아이디어 일지의 작성·수정·삭제 권한(작성 회원 또는 수정 키)과 입력 정리를 검증한다.
 * @author seulgae
 * @version 1.1, 로그인 회원 작성자 소유 추가
 * @see "None"
 */
class BoardServicesTest {
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-11-16T12:00:00Z");
    private static final Optional<UUID> ANONYMOUS = Optional.empty();

    @Test void agendaIsCreatedWithHashedTokenAndOnlyThatTokenCanChangeIt() {
        var repository = mock(MeetingAgendaRepository.class);
        var service = new MeetingAgendaService(repository);
        var id = UUID.randomUUID();
        when(repository.create(eq("분위기"), eq("방마다 색을 정해요"), anyString(), isNull()))
            .thenAnswer(call -> new MeetingAgenda(id, call.getArgument(0), call.getArgument(1), NOW, null));
        var created = service.create(new MeetingAgendaService.Request(" 분위기 ", " 방마다 색을 정해요 "), ANONYMOUS);
        var hash = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(repository).create(eq("분위기"), eq("방마다 색을 정해요"), hash.capture(), isNull());
        assertEquals(EditTokens.hash(created.editToken()), hash.getValue(), "원문 키가 아닌 해시만 저장한다");

        when(repository.ownership(id)).thenReturn(Optional.of(new Ownership(hash.getValue(), null)));
        var forbidden = assertThrows(ResponseStatusException.class, () -> service.delete(id, EditTokens.generate(), ANONYMOUS));
        assertEquals(HttpStatus.FORBIDDEN, forbidden.getStatusCode());
        verify(repository, never()).delete(any());
        service.delete(id, created.editToken(), ANONYMOUS);
        verify(repository).delete(id);

        when(repository.ownership(any())).thenReturn(Optional.empty());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
            () -> service.update(UUID.randomUUID(), new MeetingAgendaService.Request("a", "b"), created.editToken(), ANONYMOUS)).getStatusCode());
        assertThrows(ResponseStatusException.class, () -> service.create(new MeetingAgendaService.Request("칠판에안들어가는제목", "내용"), ANONYMOUS));
    }

    @Test void loggedInAuthorCanChangeWithoutTokenButOtherMembersCannot() {
        var repository = mock(MeetingAgendaRepository.class);
        var service = new MeetingAgendaService(repository);
        var id = UUID.randomUUID();
        var author = UUID.randomUUID();
        when(repository.create(anyString(), anyString(), anyString(), eq(author))).thenReturn(new MeetingAgenda(id, "회의", "내용", NOW, null));
        service.create(new MeetingAgendaService.Request("회의", "내용"), Optional.of(author));
        verify(repository).create(eq("회의"), eq("내용"), anyString(), eq(author));

        when(repository.ownership(id)).thenReturn(Optional.of(new Ownership(EditTokens.hash(EditTokens.generate()), author)));
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
            () -> service.delete(id, null, Optional.of(UUID.randomUUID()))).getStatusCode(), "다른 회원은 지울 수 없다");
        service.update(id, new MeetingAgendaService.Request("회고", "바뀜"), null, Optional.of(author));
        verify(repository).update(id, "회고", "바뀜");
    }

    @Test void agendaPageReportsNextPage() {
        var repository = mock(MeetingAgendaRepository.class);
        var rows = List.of(new MeetingAgenda(UUID.randomUUID(), "a", "b", NOW, null), new MeetingAgenda(UUID.randomUUID(), "c", "d", NOW, null));
        when(repository.list(2, 0)).thenReturn(rows);
        var page = new MeetingAgendaService(repository).list(1, 0);
        assertEquals(1, page.items().size());
        assertTrue(page.hasMore());
    }

    @Test void ideaJournalLimitsContentAndProtectsOldRecords() {
        var repository = mock(ResearchRepository.class);
        var service = new ResearchIdeaService(repository);
        var id = UUID.randomUUID();
        when(repository.nextIdeaNumber()).thenReturn(4);
        assertEquals(4, service.nextNumber());
        when(repository.createIdea(eq("연구 아이디어 일지 #4"), eq("가".repeat(130)), anyString(), isNull()))
            .thenReturn(new ResearchRecord(id, "연구 아이디어 일지 #4", "가".repeat(130), "가".repeat(130), NOW));
        var created = service.create(new IdeaRequest("연구 아이디어 일지 #4", "가".repeat(130)), ANONYMOUS);
        assertNotNull(created.editToken());
        assertThrows(ResponseStatusException.class, () -> service.create(new IdeaRequest("연구 아이디어 일지 #5", "가".repeat(131)), ANONYMOUS));

        when(repository.ownership(id)).thenReturn(Optional.of(new Ownership("", null)));
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
            () -> service.update(id, new IdeaRequest("t", "c"), created.editToken(), ANONYMOUS)).getStatusCode(), "수정 키가 없는 V1 기록은 바꿀 수 없다");
        when(repository.ownership(id)).thenReturn(Optional.of(new Ownership(EditTokens.hash(created.editToken()), null)));
        service.update(id, new IdeaRequest(" 연구 아이디어 일지 #4 ", "고친 내용"), created.editToken(), Optional.of(UUID.randomUUID()));
        verify(repository).updateIdea(id, "연구 아이디어 일지 #4", "고친 내용");
    }
}
