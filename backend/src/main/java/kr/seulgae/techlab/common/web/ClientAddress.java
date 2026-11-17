package kr.seulgae.techlab.common.web;

/**
 * 요청을 보낸 방문자 주소를 구한다. 운영에서는 Funnel이 X-Forwarded-For를 실제 방문자 주소로 새로 쓰고
 * nginx가 그 뒤에 자기 앞단 주소를 덧붙이므로 첫 주소가 방문자다. 백엔드 포트는 외부에 열려 있지 않다.
 *
 * @author seulgae
 * @version 1.0, 쓰기 제한과 로비 1주소 1연결이 같은 기준을 쓰도록 분리
 * @see "None"
 */
public final class ClientAddress {
    private ClientAddress() { }

    /**
     * @param forwardedFor X-Forwarded-For 헤더 값(없으면 null)
     * @param remoteAddress 직접 연결한 주소
     * @return 첫 전달 주소, 없거나 비정상적으로 길면 직접 연결 주소
     */
    public static String of(String forwardedFor, String remoteAddress) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String first = forwardedFor.split(",")[0].strip();
            if (!first.isEmpty() && first.length() <= 64) return first;
        }
        return String.valueOf(remoteAddress);
    }
}
