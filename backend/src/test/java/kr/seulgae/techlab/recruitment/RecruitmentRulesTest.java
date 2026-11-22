package kr.seulgae.techlab.recruitment;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 근거 누락·제외 조건·검색 인용 검증을 외부 요청 없이 확인한다.
 * @author seulgae
 * @version 1.0, 채용 규칙 회귀 검증
 * @see "None"
 */
class RecruitmentRulesTest {
    static final JsonMapper JSON=JsonMapper.builder().build();
    static ObjectNode item() {
        var facts=new LinkedHashMap<String,Object>();
        Map<String,Object> values=Map.of("javaBackend",true,"companyType","SME","employees",100,"rating",2.5,"probationMonths",3,"accepting",true);
        values.forEach((k,v)->facts.put(k,Map.of("value",v,"url",k.equals("rating")?"https://www.jobplanet.co.kr/companies/1":"https://www.saramin.co.kr/jobs/1","quote","테스트 전용 확인 근거","checkedAt",Instant.now().toString())));
        return (ObjectNode)JSON.valueToTree(Map.of("source","SARAMIN","externalId","test-1","company","테스트 회사","title","Java 백엔드","url","https://www.saramin.co.kr/jobs/1","facts",facts));
    }
    private String state(JsonNode p) {return (String)RecruitmentRules.validate(p,Instant.now()).get("state");}
    @Test void boundariesAndMissingInformation() {
        var p=item();assertEquals("ELIGIBLE",state(p));
        ((ObjectNode)p.path("facts")).remove("probationMonths");assertEquals("REVIEW",state(p));
        p=item();((ObjectNode)p.path("facts").path("employees")).put("value",99);assertEquals("REJECTED",state(p));
        p=item();((ObjectNode)p.path("facts").path("rating")).put("value",2.49);assertEquals("REJECTED",state(p));
        p=item();((ObjectNode)p.path("facts").path("companyType")).put("value","MID");assertEquals("REJECTED",state(p));
        p=item();((ObjectNode)p.path("facts").path("probationMonths")).put("value",6);assertEquals("REJECTED",state(p));
        p=item();((ObjectNode)p.path("facts").path("accepting")).put("value",false);assertEquals("REJECTED",state(p));
    }
    @Test void sourceTypeAndAgeAreRequired() {
        var p=item();((ObjectNode)p.path("facts").path("rating")).put("url","https://www.saramin.co.kr/jobs/1");assertEquals("REVIEW",state(p));
        p=item();((ObjectNode)p.path("facts").path("employees")).put("value","100");assertEquals("REVIEW",state(p));
        p=item();((ObjectNode)p.path("facts").path("rating")).put("checkedAt",Instant.now().minus(Duration.ofDays(31)).toString());assertEquals("REVIEW",state(p));
        assertFalse(RecruitmentRules.safeUrl("https://jobplanet.co.kr.evil.test/a"));
        assertFalse(RecruitmentRules.safeUrl("javascript:alert(1)"));
        assertFalse(RecruitmentRules.safeUrl("https://user:password@jobplanet.co.kr/a"));
    }
    @Test void searchSnippetsRemainUnverifiedCandidates() {
        JsonNode response=JSON.valueToTree(Map.of("query",Map.of("original","test"),"web",Map.of("results",List.of(
            Map.of("url","https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=123","title","[테스트기업] Java 백엔드 채용","description","직원 100명, 평점 4.0"),
            Map.of("url","https://www.jobkorea.co.kr/Recruit/GI_Read/456","title","Spring 개발","description","신입 가능"),
            Map.of("url","https://www.jobplanet.co.kr/companies/123","title","회사 리뷰")))));
        var parsed=RecruitmentSearch.parse(response);
        assertEquals(2,parsed.size());assertEquals("123",parsed.get(0).path("externalId").asText());
        assertEquals("테스트기업",parsed.get(0).path("company").asText());
        assertEquals("REVIEW",state(parsed.get(0)),"검색 발췌문에 숫자가 있어도 확정 근거가 아니다");
        assertEquals("미확인",parsed.get(1).path("company").asText());
        assertFalse(new RecruitmentSearch("").available());
        assertThrows(IllegalStateException.class,()->RecruitmentSearch.parse(JSON.readTree("{}")));
    }
}
