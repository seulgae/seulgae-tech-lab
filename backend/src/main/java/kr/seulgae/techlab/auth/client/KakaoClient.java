package kr.seulgae.techlab.auth.client;

import kr.seulgae.techlab.auth.dto.*;
import kr.seulgae.techlab.auth.config.*;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 카카오 OAuth 2.0 인가 코드 흐름의 외부 호출(인가 주소, 토큰 교환, 사용자 정보)이다.
 * 테스트에서는 이 클래스를 대역으로 바꿔 외부 호출 없이 검증한다.
 *
 * @author seulgae
 * @version 1.0, 카카오 로그인 외부 API
 * @see "None"
 */
@Component
public class KakaoClient {

    private static final String AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
    private static final String TOKEN = "https://kauth.kakao.com/oauth/token";
    private static final String ME = "https://kapi.kakao.com/v2/user/me";
    private final RestClient http = RestClient.create();

    public String authorizeUrl(AuthSettings settings, String state) {
        return UriComponentsBuilder.fromUriString(AUTHORIZE).queryParam("response_type", "code")
            .queryParam("client_id", settings.clientId()).queryParam("redirect_uri", settings.redirectUri())
            .queryParam("state", state).encode().build().toUriString();
    }

    /** 인가 코드를 액세스 토큰으로 바꾼 뒤 회원번호·닉네임을 읽는다. */
    @SuppressWarnings("unchecked")
    public KakaoUserDTO fetchUser(AuthSettings settings, String code) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", settings.clientId());
        form.add("redirect_uri", settings.redirectUri());
        form.add("code", code);
        if (!settings.clientSecret().isEmpty()) form.add("client_secret", settings.clientSecret());
        Map<String, Object> token = http.post().uri(TOKEN).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(Map.class);
        if (token == null || !(token.get("access_token") instanceof String accessToken)) throw new IllegalStateException("Kakao token missing");
        Map<String, Object> me = http.get().uri(ME).header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken).retrieve().body(Map.class);
        if (me == null || !(me.get("id") instanceof Number id)) throw new IllegalStateException("Kakao user missing");
        Object nickname = null;
        if (me.get("kakao_account") instanceof Map<?, ?> account && account.get("profile") instanceof Map<?, ?> profile) nickname = profile.get("nickname");
        if (nickname == null && me.get("properties") instanceof Map<?, ?> properties) nickname = properties.get("nickname");
        return new KakaoUserDTO(id.longValue(), nickname instanceof String text ? text : null);
    }
}
