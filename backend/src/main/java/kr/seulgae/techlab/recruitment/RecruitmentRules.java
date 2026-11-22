package kr.seulgae.techlab.recruitment;

import java.net.URI;
import java.time.*;
import java.util.*;
import tools.jackson.databind.JsonNode;

/**
 * 검색 추출값과 출처를 검증하고 확정 추천 여부를 Java 규칙으로 결정한다.
 * @author seulgae
 * @version 1.0, 출처 기반 채용 조건 검증
 * @see "None"
 */
public final class RecruitmentRules {
    private RecruitmentRules() {}
    /** 필수 근거가 없거나 오래됐으면 REVIEW, 명백한 제외 조건은 REJECTED로 분류한다. */
    public static Map<String, Object> validate(JsonNode item, Instant now) {
        var missing = new ArrayList<String>();
        var rejected = new ArrayList<String>();
        for (String field : List.of("javaBackend", "companyType", "employees", "rating", "probationMonths", "accepting")) {
            JsonNode fact = item.path("facts").path(field);
            if (!evidence(fact, field, now)) { missing.add(field + ": 근거 미확인"); continue; }
            JsonNode v = fact.path("value");
            boolean bad = switch (field) {
                case "javaBackend", "accepting" -> v.isBoolean() && !v.asBoolean();
                case "companyType" -> v.isTextual() && !v.asText().equals("SME");
                case "employees" -> v.isNumber() && v.asInt() < 100;
                case "rating" -> v.isNumber() && v.asDouble() < 2.5;
                case "probationMonths" -> v.isNumber() && v.asInt() == 6;
                default -> false;
            };
            boolean typed = switch(field) {
                case "javaBackend", "accepting" -> v.isBoolean();
                case "companyType" -> v.isTextual() && Set.of("SME","MID","LARGE","OTHER").contains(v.asText());
                case "employees", "probationMonths" -> v.isIntegralNumber() && v.asLong() >= 0 && v.asLong() < 10000000;
                case "rating" -> v.isNumber() && v.asDouble() >= 0 && v.asDouble() <= 5;
                default -> false;
            };
            if (!typed) missing.add(field + ": 잘못된 값"); else if (bad) rejected.add(field + ": 조건 불충족");
        }
        Instant deadline = deadline(item);
        if (deadline != null && !deadline.isAfter(now)) rejected.add("마감일 경과");
        var reasons = new ArrayList<>(rejected); reasons.addAll(missing);
        return Map.of("state", !rejected.isEmpty() ? "REJECTED" : !missing.isEmpty() ? "REVIEW" : "ELIGIBLE", "reasons", reasons);
    }
    /** 웹 출처와 인용문, 최근 30일 내 확인 시각을 요구한다. 평점은 잡플래닛 출처만 허용한다. */
    public static boolean evidence(JsonNode fact, String field, Instant now) {
        if (fact.path("quote").asText("").isBlank() || fact.path("quote").asText().length() > 1000) return false;
        String url = fact.path("url").asText("");
        if (!safeUrl(url)) return false;
        if (field.equals("rating") && !host(url, "jobplanet.co.kr")) return false;
        try {
            Instant checked = Instant.parse(fact.path("checkedAt").asText());
            return !checked.isAfter(now.plusSeconds(300)) && !checked.isBefore(now.minus(Duration.ofDays(30)));
        } catch (RuntimeException e) { return false; }
    }
    /** 검색 출처를 제한하고 주소에 인증정보를 포함하지 않도록 한다. 서버는 이 URL을 직접 요청하지 않는다. */
    public static boolean safeUrl(String url) {
        try {
            URI u = URI.create(url);
            return url.length() <= 2000 && "https".equals(u.getScheme()) && u.getUserInfo() == null &&
                (u.getPort() == -1 || u.getPort() == 443) &&
                List.of("saramin.co.kr","jobkorea.co.kr","jobplanet.co.kr").stream().anyMatch(h -> host(url,h));
        } catch (RuntimeException e) { return false; }
    }
    private static boolean host(String url, String expected) {
        String h = URI.create(url).getHost();
        return h != null && (h.equals(expected) || h.endsWith("." + expected));
    }
    /** 근거가 있는 마감일만 반환한다. 날짜만 있을 때는 해당 한국 날짜의 끝을 사용한다. */
    public static Instant deadline(JsonNode item) {
        JsonNode d = item.path("facts").path("deadline");
        if (!evidence(d,"deadline",Instant.now())) return null;
        try { return Instant.parse(d.path("value").asText()); }
        catch (RuntimeException e) {
            try { return LocalDate.parse(d.path("value").asText()).plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant(); }
            catch (RuntimeException ignored) { return null; }
        }
    }
}
