package kr.seulgae.techlab.auth;

import java.util.UUID;

/**
 * 카카오 로그인 회원. 응답에는 카카오 식별자를 내보내지 않는다.
 *
 * @param id 회원 ID
 * @param kakaoId 카카오 회원번호(서버 내부 전용)
 * @param nickname 연구소에서 쓰는 닉네임(1~16자, 글자·숫자·_·-)
 * @author seulgae
 * @version 1.0, 회원
 * @see "None"
 */
public record Member(UUID id, long kakaoId, String nickname) {
    /** 로비 닉네임과 같은 규칙 */
    public static final String NICKNAME_PATTERN = "[\\p{L}\\p{N}_-]{1,16}";

    /** 카카오 닉네임에서 허용하지 않는 문자를 빼고 16자로 자른다. 남는 글자가 없으면 연구원-xxxx를 쓴다. */
    public static String suggestNickname(String kakaoNickname, UUID id) {
        String cleaned = kakaoNickname == null ? "" : kakaoNickname.replaceAll("[^\\p{L}\\p{N}_-]", "");
        if (cleaned.codePointCount(0, cleaned.length()) > 16) cleaned = cleaned.substring(0, cleaned.offsetByCodePoints(0, 16));
        return cleaned.isEmpty() ? "연구원-" + id.toString().substring(0, 4) : cleaned;
    }
}
