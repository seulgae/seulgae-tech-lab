package kr.seulgae.techlab.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * 로그인 세션을 서버 메모리 없이 HMAC-SHA256으로 서명한 쿠키 값으로 표현한다.
 * 값 형식은 {@code 회원ID.만료초.서명}이며, 서버 재시작·재배포 후에도 유지된다.
 *
 * @author seulgae
 * @version 1.0, 서명 세션 쿠키
 * @see "None"
 */
public final class SessionCookies {
    public static final String NAME = "lab_session";
    public static final Duration TTL = Duration.ofDays(14);
    private final byte[] key;

    public SessionCookies(String secret) { this.key = secret.getBytes(StandardCharsets.UTF_8); }

    public String issue(UUID memberId, Instant now) {
        String body = memberId + "." + now.plus(TTL).getEpochSecond();
        return body + "." + sign(body);
    }

    /** 서명이 맞고 만료되지 않았을 때만 회원 ID를 돌려준다. 형식이 틀리면 빈 값이다. */
    public Optional<UUID> verify(String value, Instant now) {
        if (value == null || value.length() > 200) return Optional.empty();
        int last = value.lastIndexOf('.');
        if (last < 0) return Optional.empty();
        String body = value.substring(0, last);
        if (!MessageDigest.isEqual(sign(body).getBytes(StandardCharsets.US_ASCII), value.substring(last + 1).getBytes(StandardCharsets.US_ASCII))) return Optional.empty();
        String[] parts = body.split("\\.");
        if (parts.length != 2) return Optional.empty();
        try {
            if (Long.parseLong(parts[1]) < now.getEpochSecond()) return Optional.empty();
            return Optional.of(UUID.fromString(parts[0]));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private String sign(String body) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
