package kr.seulgae.techlab.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 카카오 로그인 설정이다. REST API 키·Redirect URI·세션 서명 비밀값이 모두 있어야 로그인이 켜진다.
 * 로그인이 꺼져 있으면 로그인 버튼이 숨겨지고, 글쓰기는 기존 수정 키 방식으로 누구나 할 수 있다.
 *
 * @author seulgae
 * @version 1.0, 카카오 로그인 활성화 조건
 * @see "None"
 */
@Component
public class AuthSettings {
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final String sessionSecret;
    private final boolean cookieSecure;

    public AuthSettings(@Value("${lab.auth.kakao.client-id:}") String clientId,
                        @Value("${lab.auth.kakao.client-secret:}") String clientSecret,
                        @Value("${lab.auth.kakao.redirect-uri:}") String redirectUri,
                        @Value("${lab.auth.session-secret:}") String sessionSecret,
                        @Value("${lab.auth.cookie-secure:true}") boolean cookieSecure) {
        this.clientId = clientId.strip();
        this.clientSecret = clientSecret.strip();
        this.redirectUri = redirectUri.strip();
        this.sessionSecret = sessionSecret.strip();
        this.cookieSecure = cookieSecure;
    }

    /** 키·주소·충분히 긴(32자 이상) 서명 비밀값이 모두 있을 때만 로그인을 켠다. */
    public boolean enabled() { return !clientId.isEmpty() && redirectUri.startsWith("http") && sessionSecret.length() >= 32; }
    public String clientId() { return clientId; }
    public String clientSecret() { return clientSecret; }
    public String redirectUri() { return redirectUri; }
    public String sessionSecret() { return sessionSecret; }
    public boolean cookieSecure() { return cookieSecure; }
}
