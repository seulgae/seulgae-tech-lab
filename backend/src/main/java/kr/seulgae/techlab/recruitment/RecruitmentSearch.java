package kr.seulgae.techlab.recruitment;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.*;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 검색엔진 API로 공개 채용 URL과 발췌문을 수집한다. LLM이나 채용 사이트 로그인은 사용하지 않는다.
 * @author seulgae
 * @version 1.0, Brave Search 기반 검색 도구
 * @see <a href="https://api-dashboard.search.brave.com/api-reference/web/search/get">Brave Web Search</a>
 */
@Component
public class RecruitmentSearch {
    private final String key;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final JsonMapper json = JsonMapper.builder().build();
    public RecruitmentSearch(@Value("${lab.recruitment.search-key:}") String key) { this.key=key; }
    public boolean available() { return !key.isBlank(); }

    /** 출처별 검색 또는 기존 원본 URL의 재검색. 검색에서 사라졌다는 이유로 마감 처리하지 않는다. */
    public List<JsonNode> search(LocalDate date,List<String> urls) {
        if(!available()) throw new IllegalStateException("SEARCH_KEY_NOT_CONFIGURED");
        var queries=urls.isEmpty()?List.of("site:saramin.co.kr Java Spring 백엔드 채용", "site:jobkorea.co.kr Java Spring 백엔드 채용"):urls.stream().limit(10).toList();
        Map<String,JsonNode> unique=new LinkedHashMap<>();
        int successes=0;
        for(String query:queries) {
            try {
                for(var p:parse(query(query))) {
                    if(!urls.isEmpty() && urls.stream().noneMatch(u->samePosting(u,p))) continue;
                    unique.put(p.path("source").asText()+":"+p.path("externalId").asText(),p);
                }
                successes++;
            } catch(IllegalStateException e) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Recruitment search subrequest failed ({})",e.getMessage());
                // 공급원 검색 하나가 실패해도 다른 출처 검색은 계속한다. 부분 실패를 후보에 기록한다.
            }
        }
        if(successes==0) throw new IllegalStateException("SEARCH_ALL_REQUESTS_FAILED");
        final boolean partial=successes<queries.size();
        unique.values().forEach(p->((ObjectNode)p).put("partialSearch",partial));
        return unique.values().stream().limit(20).toList();
    }
    /** 기업명을 확인한 후보에 한해 기업정보 검색 단서를 보완한다. 발췌문을 확정 근거로 승격하지 않는다. */
    public JsonNode inspect(JsonNode candidate) {
        var copy=(ObjectNode)candidate.deepCopy();
        String company=copy.path("company").asText("");
        if(company.isBlank() || company.equals("미확인")) return copy;
        var result=query("site:jobplanet.co.kr "+company.substring(0,Math.min(100,company.length()))+" 기업 평점 직원수");
        var clues=json.createArrayNode();
        for(var r:result.path("web").path("results")) if(RecruitmentRules.safeUrl(r.path("url").asText()))
            clues.add(json.valueToTree(Map.of("url",r.path("url").asText(),"text",clean(r.path("description").asText()),"checkedAt",Instant.now().toString())));
        copy.set("companyClues",clues);
        return copy;
    }
    private long nextRequestAt;
    private synchronized JsonNode query(String query) {
        try {
            long pause=nextRequestAt-System.nanoTime();
            if(pause>0) Thread.sleep(Math.max(1,pause/1000000));
            nextRequestAt=System.nanoTime()+1000000000L;
            URI uri=URI.create("https://api.search.brave.com/res/v1/web/search?q="+URLEncoder.encode(query,StandardCharsets.UTF_8)+"&country=KR&search_lang=ko&count=20&extra_snippets=true&text_decorations=false&result_filter=web");
            var request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).header("X-Subscription-Token",key).header("Accept","application/json").GET().build();
            var response=http.send(request,HttpResponse.BodyHandlers.ofInputStream());
            byte[] bytes;
            try(var stream=response.body()) { bytes=stream.readNBytes(500001); }
            if(response.statusCode()!=200 || bytes.length>500000) throw new IllegalStateException("SEARCH_HTTP_"+response.statusCode());
            return json.readTree(bytes);
        } catch(InterruptedException e) {Thread.currentThread().interrupt();throw new IllegalStateException("SEARCH_INTERRUPTED");}
        catch(java.io.IOException e) {throw new IllegalStateException("SEARCH_NETWORK_ERROR");}
    }
    /** 실제 공고 ID가 있는 결과만 후보로 만든다. 검색 발췌문은 별도 저장하고 필수 사실은 미확인으로 둔다. */
    static List<JsonNode> parse(JsonNode response) {
        var results=response.path("web").path("results");
        if(!results.isArray() && !response.has("query")) throw new IllegalStateException("SEARCH_INVALID_RESPONSE");
        var json=JsonMapper.builder().build();var output=new ArrayList<JsonNode>();
        for(var r:results) {
            String url=r.path("url").asText("");
            if(!RecruitmentRules.safeUrl(url)) continue;
            String source=URI.create(url).getHost().endsWith("saramin.co.kr")?"SARAMIN":"JOBKOREA";
            String id=postingId(url,source);
            String title=clean(r.path("title").asText(""));
            if(id==null || title.isBlank()) continue;
            var p=json.createObjectNode();p.put("source",source);p.put("externalId",id);p.put("url",url);p.put("title",title);
            // 대괄호 기업명이 없는 제목에서 임의로 기업명을 추정하지 않는다.
            var company=Pattern.compile("^\\[([^]\\r\\n]{1,100})\\]").matcher(title);
            p.put("company",company.find()?company.group(1):"미확인");
            p.put("companyConfirmed",false);p.put("searchCheckedAt",Instant.now().toString());
            p.put("snippet",clean(r.path("description").asText("")));
            var snippets=json.createArrayNode();for(var extra:r.path("extra_snippets")) snippets.add(clean(extra.asText()));p.set("extraSnippets",snippets);
            p.set("facts",json.createObjectNode());output.add(p);
        }
        return output;
    }
    private static String postingId(String url,String source) {
        var matcher=Pattern.compile(source.equals("SARAMIN")?"[?&]rec_idx=(\\d+)":"(?i)/Recruit/GI_Read/(\\d+)").matcher(url);
        return matcher.find()?matcher.group(1):null;
    }
    private static boolean samePosting(String url,JsonNode p) {return Objects.equals(postingId(url,p.path("source").asText()),p.path("externalId").asText());}
    private static String clean(String text) {
        String plain=text.replaceAll("<[^>]*>","").replace("&amp;","&").replace("&quot;","\"").replace("&lt;","<").replace("&gt;",">").strip();
        return plain.substring(0,Math.min(2000,plain.length()));
    }
}
