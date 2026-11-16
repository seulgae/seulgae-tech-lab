package kr.seulgae.techlab.common.write;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * 로그인 없는 글의 수정·삭제 권한을 작성한 브라우저에만 주는 임의 키를 만들고 검증한다.
 * DB에는 SHA-256 해시만 저장하며, 원문 키는 생성 응답에서 한 번만 돌려준다.
 *
 * @author seulgae
 * @version 1.0, 익명 작성 글의 소유 확인
 * @see "None"
 */
public final class EditTokens {
    private static final SecureRandom RANDOM = new SecureRandom();
    private EditTokens() {}

    /** @return URL에 안전한 32바이트 임의 키(43자) */
    public static String generate() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** @return 키의 SHA-256 소문자 16진 해시(64자) */
    public static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** 형식이 맞는 키만 해시해 상수 시간으로 비교한다. 해시가 없는 기존 글은 항상 거부한다. */
    public static boolean matches(String token, String storedHash) {
        if (token == null || storedHash == null || !token.matches("[A-Za-z0-9_-]{43}")) return false;
        return MessageDigest.isEqual(hash(token).getBytes(StandardCharsets.US_ASCII), storedHash.getBytes(StandardCharsets.US_ASCII));
    }
}
