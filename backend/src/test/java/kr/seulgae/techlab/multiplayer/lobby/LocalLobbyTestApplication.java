package kr.seulgae.techlab.multiplayer.lobby;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import kr.seulgae.techlab.auth.AuthController;
import kr.seulgae.techlab.auth.AuthService;
import kr.seulgae.techlab.auth.AuthSettings;
import kr.seulgae.techlab.auth.KakaoClient;
import kr.seulgae.techlab.auth.Member;
import kr.seulgae.techlab.auth.MemberRepository;
import kr.seulgae.techlab.common.write.Ownership;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.lab.status.LabStatusController;
import kr.seulgae.techlab.inventory.InMemoryInventoryStore;
import kr.seulgae.techlab.lobby.guestbook.GuestbookController;
import kr.seulgae.techlab.lobby.guestbook.GuestbookService;
import kr.seulgae.techlab.lobby.guestbook.GuestbookStore;
import kr.seulgae.techlab.lobby.guestbook.InMemoryGuestbookStore;
import kr.seulgae.techlab.inventory.InventoryController;
import kr.seulgae.techlab.inventory.InventoryService;
import kr.seulgae.techlab.inventory.InventoryStore;
import kr.seulgae.techlab.office.work.InMemoryWorkStore;
import kr.seulgae.techlab.office.work.WorkItemController;
import kr.seulgae.techlab.office.work.WorkItemService;
import kr.seulgae.techlab.office.work.WorkStore;
import kr.seulgae.techlab.meeting.agendas.MeetingAgenda;
import kr.seulgae.techlab.meeting.agendas.MeetingAgendaController;
import kr.seulgae.techlab.meeting.agendas.MeetingAgendaRepository;
import kr.seulgae.techlab.meeting.agendas.MeetingAgendaService;
import kr.seulgae.techlab.multiplayer.lobby.config.LobbyWebSocketConfig;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import kr.seulgae.techlab.multiplayer.lobby.websocket.LobbySocketHandler;
import kr.seulgae.techlab.common.web.ApiExceptionHandler;
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
    ApiExceptionHandler.class, LabStatusController.class, MeetingAgendaController.class, MeetingAgendaService.class, WriteRateLimiter.class,
    AuthSettings.class, AuthService.class, AuthController.class, KakaoClient.class, WorkItemController.class, WorkItemService.class,
    InventoryController.class, InventoryService.class, GuestbookController.class, GuestbookService.class, kr.seulgae.techlab.admin.AdminAccess.class,
    kr.seulgae.techlab.auth.LevelService.class, kr.seulgae.techlab.auth.LevelController.class,
    kr.seulgae.techlab.inventory.BankService.class, kr.seulgae.techlab.inventory.BankController.class,
    kr.seulgae.techlab.phone.TodoService.class, kr.seulgae.techlab.phone.TodoController.class,
    kr.seulgae.techlab.phone.SnsService.class, kr.seulgae.techlab.phone.SnsController.class,
    kr.seulgae.techlab.lab.capacity.SshProbe.class, kr.seulgae.techlab.lab.capacity.ServerCapacityService.class, kr.seulgae.techlab.lab.capacity.ServerCapacityController.class,
    kr.seulgae.techlab.lab.pulls.GithubPullsService.class, kr.seulgae.techlab.lab.pulls.GithubPullsController.class})
public class LocalLobbyTestApplication {
    private static final OffsetDateTime CREATED_AT = OffsetDateTime.parse("2026-11-15T12:00:00+09:00");

    /** 테스트 클래스 경로에서만 실행되며 운영 JAR에는 포함되지 않는다. */
    public static void main(String[] args) { SpringApplication.run(LocalLobbyTestApplication.class, args); }

    /** 사무실 업무 게시판(DB 없는 로컬 실행) */
    @Bean
    WorkStore fixtureWorkStore() { return new InMemoryWorkStore(); }

    /** 인벤토리(DB 없는 로컬 실행) */
    @Bean
    InventoryStore fixtureInventoryStore() { return new InMemoryInventoryStore(); }

    /** 폰 캘린더 할 일(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.phone.TodoStore fixtureTodoStore() { return new kr.seulgae.techlab.phone.InMemoryPhoneStores.Todos(); }

    /** 폰 SNS(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.phone.SnsStore fixtureSnsStore() { return new kr.seulgae.techlab.phone.InMemoryPhoneStores.Sns(); }

    /** 로비 방명록(DB 없는 로컬 실행) */
    @Bean
    GuestbookStore fixtureGuestbookStore() { return new InMemoryGuestbookStore(); }

    @Bean
    MeetingAgendaRepository fixtureAgendaRepository() {
        Map<UUID, MeetingAgenda> agendas = new ConcurrentHashMap<>();
        Map<UUID, String> hashes = new ConcurrentHashMap<>();
        return new MeetingAgendaRepository(null) {
            @Override public List<MeetingAgenda> list(int limit, int offset) {
                return agendas.values().stream().sorted(Comparator.comparing(MeetingAgenda::createdAt).reversed()).skip(offset).limit(limit).toList();
            }
            @Override public MeetingAgenda create(String title, String content, String hash, UUID authorId) {
                var agenda = new MeetingAgenda(UUID.randomUUID(), title, content, OffsetDateTime.now(), null);
                agendas.put(agenda.id(), agenda); hashes.put(agenda.id(), hash);
                return agenda;
            }
            @Override public Optional<Ownership> ownership(UUID id) { return Optional.ofNullable(hashes.get(id)).map(hash -> new Ownership(hash, null)); }
            @Override public MeetingAgenda update(UUID id, String title, String content) {
                var agenda = new MeetingAgenda(id, title, content, agendas.get(id).createdAt(), OffsetDateTime.now());
                agendas.put(id, agenda);
                return agenda;
            }
            @Override public int delete(UUID id) { hashes.remove(id); return agendas.remove(id) == null ? 0 : 1; }
        };
    }

    /** 회원 등급·등급 신청(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.auth.LevelRequestStore fixtureLevelRequestStore() { return new kr.seulgae.techlab.auth.InMemoryLevelRequestStore(); }

    @Bean
    MemberRepository fixtureMemberRepository() {
        Map<UUID, Member> members = new ConcurrentHashMap<>();
        return new MemberRepository(null) {
            @Override public Optional<Member> findById(UUID id) { return Optional.ofNullable(members.get(id)); }
            @Override public Optional<Member> loginByKakaoId(long kakaoId) { return members.values().stream().filter(m -> m.kakaoId() == kakaoId).findFirst(); }
            @Override public Member create(UUID id, long kakaoId, String nickname) { var m = new Member(id, kakaoId, nickname); members.put(id, m); return m; }
            @Override public void updateNickname(UUID id, String nickname) { members.computeIfPresent(id, (key, m) -> new Member(key, m.kakaoId(), nickname)); }
            @Override public List<UUID> recentAgendaIds(UUID memberId) { return List.of(); }
        };
    }
}
