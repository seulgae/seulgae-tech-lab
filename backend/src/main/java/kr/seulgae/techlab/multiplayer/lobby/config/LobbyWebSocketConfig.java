package kr.seulgae.techlab.multiplayer.lobby.config;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import kr.seulgae.techlab.common.web.ClientAddress;
import kr.seulgae.techlab.multiplayer.lobby.websocket.LobbySocketHandler;
import kr.seulgae.techlab.auth.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * 로비 WebSocket과 명시적인 Origin 허용 목록, 수신 크기 제한을 설정한다.
 *
 * @author seulgae
 * @version 1.0, 동일 서비스 및 로컬 개발 Origin 검증
 * @see "None"
 */
@Configuration
@EnableWebSocket
@EnableScheduling
public class LobbyWebSocketConfig implements WebSocketConfigurer {
    private final LobbySocketHandler handler;
    private final kr.seulgae.techlab.usemap.websocket.UseMapSocketHandler usemap;
    private final Set<String> origins;
    private final AuthService auth;

    public LobbyWebSocketConfig(LobbySocketHandler handler, kr.seulgae.techlab.usemap.websocket.UseMapSocketHandler usemap, AuthService auth,
        @Value("${lab.multiplayer.allowed-origins:http://localhost:5173,http://127.0.0.1:5173,http://localhost:5188,http://127.0.0.1:5188,https://seulgae-server.tailac4b36.ts.net}") String allowedOrigins) {
        this.handler = handler;
        this.usemap = usemap;
        this.auth = auth;
        origins = Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(value -> !value.isEmpty()).collect(Collectors.toUnmodifiableSet());
        if (origins.isEmpty() || origins.stream().anyMatch(value -> value.contains("*"))) throw new IllegalArgumentException("Explicit WebSocket origins required");
    }

    /** Origin이 없거나 허용되지 않은 핸드셰이크를 업그레이드 전에 거부한다. */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        var interceptor = new HandshakeInterceptor() {
            @Override public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler socket, Map<String, Object> attributes) {
                String origin = request.getHeaders().getOrigin();
                if (origin != null && origins.contains(origin)) {
                    // 1주소 1연결 판단에 쓸 방문자 주소를 연결 속성에 남긴다.
                    var remote = request.getRemoteAddress();
                    attributes.put(LobbySocketHandler.CLIENT_ADDRESS, ClientAddress.of(request.getHeaders().getFirst("X-Forwarded-For"),
                        remote == null || remote.getAddress() == null ? null : remote.getAddress().getHostAddress()));
                    // 로그인 회원이면 회의실 아이템 교환에 쓸 회원 id를 남긴다(세션 쿠키 검증).
                    if (request instanceof ServletServerHttpRequest servlet) auth.current(servlet.getServletRequest())
                        .ifPresent(member -> attributes.put(LobbySocketHandler.MEMBER_ID, member.id()));
                    return true;
                }
                response.setStatusCode(HttpStatus.FORBIDDEN);
                return false;
            }
            @Override public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler socket, Exception exception) {}
        };
        registry.addHandler(handler, "/ws/lobby").setAllowedOrigins(origins.toArray(String[]::new)).addInterceptors(interceptor);
        // 실습 연구실 유즈맵 대기실(방·채팅·게임 중계). 같은 Origin 검사와 회원 확인을 쓴다.
        registry.addHandler(usemap, "/ws/usemap").setAllowedOrigins(origins.toArray(String[]::new)).addInterceptors(interceptor);
    }

    /** @return 수신 크기와 유휴 시간을 제한한 내장 WebSocket 컨테이너 설정 */
    @Bean
    public ServletServerContainerFactoryBean lobbySocketContainer() {
        var container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(1024);
        container.setMaxBinaryMessageBufferSize(128);
        container.setMaxSessionIdleTimeout(20_000L);
        return container;
    }
}
