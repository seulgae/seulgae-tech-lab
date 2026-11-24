package kr.seulgae.techlab.multiplayer.lobby;

import kr.seulgae.techlab.admin.service.impl.*;
import kr.seulgae.techlab.auth.client.*;
import kr.seulgae.techlab.auth.config.*;
import kr.seulgae.techlab.auth.controller.*;
import kr.seulgae.techlab.auth.entity.*;
import kr.seulgae.techlab.auth.repository.impl.*;
import kr.seulgae.techlab.auth.repository.*;
import kr.seulgae.techlab.auth.service.impl.*;
import kr.seulgae.techlab.inventory.controller.*;
import kr.seulgae.techlab.inventory.repository.impl.*;
import kr.seulgae.techlab.inventory.repository.*;
import kr.seulgae.techlab.inventory.service.impl.*;
import kr.seulgae.techlab.lab.capacity.client.*;
import kr.seulgae.techlab.lab.capacity.controller.*;
import kr.seulgae.techlab.lab.capacity.service.impl.*;
import kr.seulgae.techlab.lab.pulls.controller.*;
import kr.seulgae.techlab.lab.pulls.service.impl.*;
import kr.seulgae.techlab.lab.status.controller.*;
import kr.seulgae.techlab.lobby.guestbook.controller.*;
import kr.seulgae.techlab.lobby.guestbook.repository.*;
import kr.seulgae.techlab.lobby.guestbook.repository.impl.*;
import kr.seulgae.techlab.lobby.guestbook.service.impl.*;
import kr.seulgae.techlab.meeting.agendas.controller.*;
import kr.seulgae.techlab.meeting.agendas.entity.*;
import kr.seulgae.techlab.meeting.agendas.repository.*;
import kr.seulgae.techlab.meeting.agendas.service.impl.*;
import kr.seulgae.techlab.multiplayer.lobby.config.*;
import kr.seulgae.techlab.multiplayer.lobby.domain.*;
import kr.seulgae.techlab.phone.controller.*;
import kr.seulgae.techlab.phone.repository.impl.*;
import kr.seulgae.techlab.phone.repository.*;
import kr.seulgae.techlab.phone.service.impl.*;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import kr.seulgae.techlab.auth.controller.AuthController;
import kr.seulgae.techlab.auth.config.AuthSettings;
import kr.seulgae.techlab.auth.client.KakaoClient;
import kr.seulgae.techlab.auth.entity.Member;
import kr.seulgae.techlab.auth.repository.MemberRepository;
import kr.seulgae.techlab.common.write.Ownership;
import kr.seulgae.techlab.common.write.WriteRateLimiter;
import kr.seulgae.techlab.lab.status.controller.LabStatusController;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.lobby.guestbook.controller.GuestbookController;
import kr.seulgae.techlab.lobby.guestbook.repository.GuestbookRepository;
import kr.seulgae.techlab.lobby.guestbook.repository.impl.InMemoryGuestbookRepository;
import kr.seulgae.techlab.inventory.controller.InventoryController;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.meeting.agendas.entity.MeetingAgenda;
import kr.seulgae.techlab.meeting.agendas.controller.MeetingAgendaController;
import kr.seulgae.techlab.meeting.agendas.repository.MeetingAgendaRepository;
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
    ApiExceptionHandler.class, LabStatusController.class, MeetingAgendaController.class, MeetingAgendaServiceImpl.class, WriteRateLimiter.class,
    AuthSettings.class, AuthServiceImpl.class, AuthController.class, KakaoClient.class,
    InventoryController.class, InventoryServiceImpl.class, GuestbookController.class, GuestbookServiceImpl.class, kr.seulgae.techlab.admin.service.impl.AdminAccessImpl.class,
    kr.seulgae.techlab.auth.service.impl.LevelServiceImpl.class, kr.seulgae.techlab.auth.controller.LevelController.class,
    kr.seulgae.techlab.inventory.service.impl.BankServiceImpl.class, kr.seulgae.techlab.inventory.controller.BankController.class,
    kr.seulgae.techlab.phone.service.impl.TodoServiceImpl.class, kr.seulgae.techlab.phone.controller.TodoController.class,
    kr.seulgae.techlab.phone.service.impl.SnsServiceImpl.class, kr.seulgae.techlab.phone.controller.SnsController.class,
    kr.seulgae.techlab.lab.capacity.client.SshProbe.class, kr.seulgae.techlab.lab.capacity.service.impl.ServerCapacityServiceImpl.class, kr.seulgae.techlab.lab.capacity.controller.ServerCapacityController.class,
    kr.seulgae.techlab.lab.pulls.service.impl.GithubPullsServiceImpl.class, kr.seulgae.techlab.lab.pulls.controller.GithubPullsController.class,
    kr.seulgae.techlab.dorm.service.impl.DormServiceImpl.class, kr.seulgae.techlab.dorm.controller.DormController.class,
    kr.seulgae.techlab.savings.service.impl.SavingsServiceImpl.class, kr.seulgae.techlab.savings.controller.SavingsController.class,
    kr.seulgae.techlab.stock.service.impl.StockServiceImpl.class, kr.seulgae.techlab.stock.controller.StockController.class,
    kr.seulgae.techlab.gamble.service.impl.GambleServiceImpl.class, kr.seulgae.techlab.gamble.controller.GambleController.class,
    kr.seulgae.techlab.office.common.WorkReward.class,
    kr.seulgae.techlab.office.idea.service.impl.IdeaPostServiceImpl.class, kr.seulgae.techlab.office.idea.controller.IdeaPostController.class,
    kr.seulgae.techlab.office.qa.service.impl.QaTicketServiceImpl.class, kr.seulgae.techlab.office.qa.controller.QaTicketController.class,
    kr.seulgae.techlab.office.desk.service.impl.DeskServiceImpl.class, kr.seulgae.techlab.office.desk.controller.DeskController.class})
public class LocalLobbyTestApplication {
    private static final OffsetDateTime CREATED_AT = OffsetDateTime.parse("2026-11-15T12:00:00+09:00");

    /** 테스트 클래스 경로에서만 실행되며 운영 JAR에는 포함되지 않는다. */
    public static void main(String[] args) { SpringApplication.run(LocalLobbyTestApplication.class, args); }

    /** 아이디어 기획 게시판(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.office.idea.repository.IdeaPostRepository fixtureIdeaStore() { return new kr.seulgae.techlab.office.board.InMemoryOfficeBoards.Ideas(); }

    /** QA 게시판(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.office.qa.repository.QaTicketRepository fixtureQaStore() { return new kr.seulgae.techlab.office.board.InMemoryOfficeBoards.Tickets(); }

    /** 인벤토리(DB 없는 로컬 실행) */
    @Bean
    InventoryRepository fixtureInventoryStore() { return new InMemoryInventoryRepository(); }

    /** 폰 캘린더 할 일(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.phone.repository.TodoRepository fixtureTodoStore() { return new kr.seulgae.techlab.phone.repository.impl.InMemoryPhoneRepositories.Todos(); }

    /** 폰 SNS(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.phone.repository.SnsRepository fixtureSnsStore() { return new kr.seulgae.techlab.phone.repository.impl.InMemoryPhoneRepositories.Sns(); }

    /** 개인 기숙사 가구(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.dorm.repository.DormRepository fixtureDormStore() { return new kr.seulgae.techlab.dorm.repository.impl.InMemoryDormRepository(); }

    /** 은행 적금(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.savings.repository.SavingsRepository fixtureSavingsStore() { return new kr.seulgae.techlab.savings.repository.impl.InMemorySavingsRepository(); }

    /** 주식 앱(DB 없는 로컬 실행) */
    @Bean
    kr.seulgae.techlab.stock.repository.StockRepository fixtureStockStore() { return new kr.seulgae.techlab.stock.repository.impl.InMemoryStockRepository(); }

    /** 로비 방명록(DB 없는 로컬 실행) */
    @Bean
    GuestbookRepository fixtureGuestbookStore() { return new InMemoryGuestbookRepository(); }

    @Bean
    MeetingAgendaRepository fixtureAgendaRepository() {
        Map<UUID, MeetingAgenda> agendas = new ConcurrentHashMap<>();
        Map<UUID, String> hashes = new ConcurrentHashMap<>();
        return new MeetingAgendaRepository() {
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
    kr.seulgae.techlab.auth.repository.LevelRequestRepository fixtureLevelRequestStore() { return new kr.seulgae.techlab.auth.repository.impl.InMemoryLevelRequestRepository(); }

    @Bean
    MemberRepository fixtureMemberRepository() {
        Map<UUID, Member> members = new ConcurrentHashMap<>();
        return new MemberRepository() {
            @Override public Optional<Member> findById(UUID id) { return Optional.ofNullable(members.get(id)); }
            @Override public Optional<Member> loginByKakaoId(long kakaoId) { return members.values().stream().filter(m -> m.kakaoId() == kakaoId).findFirst(); }
            @Override public Member create(UUID id, long kakaoId, String nickname) { var m = new Member(id, kakaoId, nickname); members.put(id, m); return m; }
            @Override public void updateNickname(UUID id, String nickname) { members.computeIfPresent(id, (key, m) -> new Member(key, m.kakaoId(), nickname)); }
            @Override public List<UUID> recentAgendaIds(UUID memberId) { return List.of(); }
        };
    }
}
