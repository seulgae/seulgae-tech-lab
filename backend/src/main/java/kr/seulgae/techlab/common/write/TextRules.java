package kr.seulgae.techlab.common.write;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * 사용자 입력 글의 공백 정리와 글자 수(유니코드 코드 포인트)·문자 종류를 검증한다.
 * Bean Validation의 {@code @Size}는 UTF-16 단위를 세므로 이모지가 섞이면 DB 글자 수와 어긋난다.
 *
 * @author seulgae
 * @version 1.0, 제목·내용 공통 검증
 * @see "None"
 */
public final class TextRules {
    private TextRules() {}

    /** 한 줄 제목: 앞뒤 공백을 지우고 1~max자, 줄바꿈·제어 문자 금지 */
    public static String title(String value, int max, String field) { return check(value, max, field, false); }

    /** 여러 줄 내용: 줄바꿈은 LF로 통일하고 1~max자, 줄바꿈·탭 외 제어 문자 금지 */
    public static String content(String value, int max, String field) { return check(value, max, field, true); }

    private static String check(String value, int max, String field, boolean multiline) {
        if (value == null) throw invalid(field + " is required");
        String text = value.replace("\r\n", "\n").replace('\r', '\n').strip();
        int length = text.codePointCount(0, text.length());
        if (length < 1 || length > max) throw invalid(field + " must be 1-" + max + " characters");
        boolean bad = text.codePoints().anyMatch(c -> c >= 0xd800 && c <= 0xdfff
            || Character.isISOControl(c) && !(multiline && (c == '\n' || c == '\t')));
        if (bad) throw invalid(field + " contains unsupported characters");
        return text;
    }

    private static ResponseStatusException invalid(String reason) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason); }
}
