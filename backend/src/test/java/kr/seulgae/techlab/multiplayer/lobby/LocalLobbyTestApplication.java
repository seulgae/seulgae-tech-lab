package kr.seulgae.techlab.multiplayer.lobby;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.lab.status.LabStatusController;
import kr.seulgae.techlab.meeting.agendas.MeetingAgenda;
import kr.seulgae.techlab.meeting.agendas.MeetingAgendaController;
import kr.seulgae.techlab.meeting.agendas.MeetingAgendaRepository;
import kr.seulgae.techlab.meeting.agendas.MeetingAgendaService;
import kr.seulgae.techlab.multiplayer.lobby.config.LobbyWebSocketConfig;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import kr.seulgae.techlab.multiplayer.lobby.websocket.LobbySocketHandler;
import kr.seulgae.techlab.research.records.controller.ResearchController;
import kr.seulgae.techlab.research.records.controller.ResearchIdeaController;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.domain.ResearchSummary;
import kr.seulgae.techlab.research.records.exception.ApiExceptionHandler;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import kr.seulgae.techlab.research.records.service.ResearchIdeaService;
import kr.seulgae.techlab.research.records.service.ResearchService;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

/**
 * DB·서버 접속 없이 실제 HTTP·WebSocket 검증을 실행하는 테스트 전용 앱이다.
 * 연구 기록·아이디어 일지·회의 안건은 메모리에만 저장하며 재시작하면 사라진다.
 *
 * @author seulgae
 * @version 1.1, 로컬 브라우저 검증용 메모리 저장소(아이디어 일지·회의 안건 포함)
 * @see "None"
 */
@Configuration(proxyBeanMethods = false)
@EnableAutoConfiguration(excludeName = "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration")
@Import({LobbyWebSocketConfig.class, LobbySocketHandler.class, LobbyRoom.class, LobbyWorld.class, LobbyChat.class,
    ResearchController.class, ResearchService.class, ApiExceptionHandler.class, LabStatusController.class,
    ResearchIdeaController.class, ResearchIdeaService.class, MeetingAgendaController.class, MeetingAgendaService.class, WriteRateLimiter.class})
public class LocalLobbyTestApplication {
    public static final UUID RECORD_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final OffsetDateTime CREATED_AT = OffsetDateTime.parse("2026-11-15T12:00:00+09:00");

    /** 테스트 클래스 경로에서만 실행되며 운영 JAR에는 포함되지 않는다. */
    public static void main(String[] args) { SpringApplication.run(LocalLobbyTestApplication.class, args); }

    @Bean
    ResearchRepository fixtureResearchRepository() {
        Map<UUID, ResearchRecord> records = new ConcurrentHashMap<>();
        Map<UUID, String> hashes = new ConcurrentHashMap<>();
        records.put(RECORD_ID, new ResearchRecord(RECORD_ID, "로컬 검증용 연구 기록", "테스트 요약", "두 브라우저의 캐릭터 이동과 연구 기록 패널을 로컬에서 확인합니다.", CREATED_AT));
        return new ResearchRepository(null) {
            @Override public List<ResearchSummary> list(int limit, int offset) {
                return records.values().stream().sorted(Comparator.comparing(ResearchRecord::createdAt).reversed()).skip(offset).limit(limit)
                    .map(r -> new ResearchSummary(r.id(), r.title(), r.summary(), r.createdAt())).toList();
            }
            @Override public Optional<ResearchRecord> find(UUID id) { return Optional.ofNullable(records.get(id)); }
            @Override public int nextIdeaNumber() {
                return records.values().stream().map(r -> r.title().matches("연구 아이디어 일지 #\\d{1,6}") ? Integer.parseInt(r.title().substring(r.title().indexOf('#') + 1)) : 0)
                    .max(Integer::compare).orElse(0) + 1;
            }
            @Override public ResearchRecord createIdea(String title, String content, String hash) {
                var record = new ResearchRecord(UUID.randomUUID(), title, content, content, OffsetDateTime.now());
                records.put(record.id(), record); hashes.put(record.id(), hash);
                return record;
            }
            @Override public Optional<String> editTokenHash(UUID id) { return records.containsKey(id) ? Optional.of(hashes.getOrDefault(id, "")) : Optional.empty(); }
            @Override public ResearchRecord updateIdea(UUID id, String title, String content) {
                var record = new ResearchRecord(id, title, content, content, records.get(id).createdAt());
                records.put(id, record);
                return record;
            }
            @Override public int delete(UUID id) { hashes.remove(id); return records.remove(id) == null ? 0 : 1; }
        };
    }

    @Bean
    MeetingAgendaRepository fixtureAgendaRepository() {
        Map<UUID, MeetingAgenda> agendas = new ConcurrentHashMap<>();
        Map<UUID, String> hashes = new ConcurrentHashMap<>();
        return new MeetingAgendaRepository(null) {
            @Override public List<MeetingAgenda> list(int limit, int offset) {
                return agendas.values().stream().sorted(Comparator.comparing(MeetingAgenda::createdAt).reversed()).skip(offset).limit(limit).toList();
            }
            @Override public MeetingAgenda create(String title, String content, String hash) {
                var agenda = new MeetingAgenda(UUID.randomUUID(), title, content, OffsetDateTime.now(), null);
                agendas.put(agenda.id(), agenda); hashes.put(agenda.id(), hash);
                return agenda;
            }
            @Override public Optional<String> editTokenHash(UUID id) { return Optional.ofNullable(hashes.get(id)); }
            @Override public MeetingAgenda update(UUID id, String title, String content) {
                var agenda = new MeetingAgenda(id, title, content, agendas.get(id).createdAt(), OffsetDateTime.now());
                agendas.put(id, agenda);
                return agenda;
            }
            @Override public int delete(UUID id) { hashes.remove(id); return agendas.remove(id) == null ? 0 : 1; }
        };
    }
}
