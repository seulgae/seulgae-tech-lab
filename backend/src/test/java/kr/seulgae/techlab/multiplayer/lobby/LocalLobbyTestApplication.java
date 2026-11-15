package kr.seulgae.techlab.multiplayer.lobby;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.multiplayer.lobby.config.LobbyWebSocketConfig;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyRoom;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyChat;
import kr.seulgae.techlab.multiplayer.lobby.domain.LobbyWorld;
import kr.seulgae.techlab.multiplayer.lobby.websocket.LobbySocketHandler;
import kr.seulgae.techlab.research.records.controller.ResearchController;
import kr.seulgae.techlab.research.records.domain.ResearchRecord;
import kr.seulgae.techlab.research.records.domain.ResearchSummary;
import kr.seulgae.techlab.research.records.exception.ApiExceptionHandler;
import kr.seulgae.techlab.research.records.repository.ResearchRepository;
import kr.seulgae.techlab.research.records.service.ResearchService;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

/**
 * DB·서버 접속 없이 실제 HTTP·WebSocket 검증을 실행하는 테스트 전용 앱이다.
 *
 * @author seulgae
 * @version 1.0, 로컬 브라우저 및 소켓 통합 검증용 고정 연구 기록
 * @see "None"
 */
@Configuration(proxyBeanMethods = false)
@EnableAutoConfiguration(excludeName = "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration")
@Import({LobbyWebSocketConfig.class, LobbySocketHandler.class, LobbyRoom.class, LobbyWorld.class, LobbyChat.class,
    ResearchController.class, ResearchService.class, ApiExceptionHandler.class})
public class LocalLobbyTestApplication {
    public static final UUID RECORD_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final OffsetDateTime CREATED_AT = OffsetDateTime.parse("2026-11-15T12:00:00+09:00");

    /** 테스트 클래스 경로에서만 실행되며 운영 JAR에는 포함되지 않는다. */
    public static void main(String[] args) { SpringApplication.run(LocalLobbyTestApplication.class, args); }

    @Bean
    ResearchRepository fixtureResearchRepository() {
        return new ResearchRepository(null) {
            @Override public List<ResearchSummary> list(int limit, int offset) {
                return offset == 0 ? List.of(new ResearchSummary(RECORD_ID, "로컬 검증용 연구 기록", "운영 DB를 사용하지 않는 테스트 데이터입니다.", CREATED_AT)) : List.of();
            }
            @Override public Optional<ResearchRecord> find(UUID id) {
                return id.equals(RECORD_ID) ? Optional.of(new ResearchRecord(RECORD_ID, "로컬 검증용 연구 기록", "테스트 요약", "두 브라우저의 캐릭터 이동과 연구 기록 패널을 로컬에서 확인합니다.", CREATED_AT)) : Optional.empty();
            }
        };
    }
}
