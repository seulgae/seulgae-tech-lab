package kr.seulgae.techlab.lab.pulls.service.impl;

import kr.seulgae.techlab.lab.pulls.dto.*;
import kr.seulgae.techlab.lab.pulls.service.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 개발 연구실 슈퍼컴퓨터의 GitHub PR 목록. 공개 저장소라 토큰 없이 GitHub REST API를 부르고,
 * 비회원 한도(IP당 시간 60번)를 넘지 않게 결과를 5분 동안 캐시한다. 실패하면 마지막 성공 목록을 "오래됨" 표시와 함께 돌려준다.
 *
 * @author seulgae
 * @version 1.0, GitHub PR 목록
 * @see "None"
 */
@Service
public class GithubPullsServiceImpl implements GithubPullsService {
    private static final Logger log = LoggerFactory.getLogger(GithubPullsService.class);
    static final Duration CACHE = Duration.ofMinutes(5);
    static final int OPEN_LIMIT = 20, MERGED_LIMIT = 15;


    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final String repo;
    private final Function<String, String> fetch;
    private final Supplier<Instant> clock;
    private PullsDTO cached;
    private Instant cachedAt;

    @Autowired
    public GithubPullsServiceImpl(@Value("${lab.github.repo:seulgae/seulgae-tech-lab}") String repo) {
        this(repo, httpGet(), Instant::now);
    }

    public GithubPullsServiceImpl(String repo, Function<String, String> fetch, Supplier<Instant> clock) {
        // 소유자/저장소 이름만 허용한다(".." 같은 경로 조각은 거절).
        if (!repo.matches("[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*")) throw new IllegalArgumentException("Invalid repository");
        this.repo = repo; this.fetch = fetch; this.clock = clock;
    }

    private static Function<String, String> httpGet() {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NORMAL).build();
        return url -> {
            try {
                var response = client.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8))
                    .header("Accept", "application/vnd.github+json").header("X-GitHub-Api-Version", "2022-11-28")
                    .header("User-Agent", "seulgae-tech-lab").GET().build(), HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) throw new IllegalStateException("GitHub responded " + response.statusCode());
                return response.body();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted", exception);
            } catch (java.io.IOException exception) {
                throw new IllegalStateException(exception.getClass().getSimpleName(), exception);
            }
        };
    }

    /** 캐시가 5분 안이면 그대로, 아니면 GitHub에서 다시 받는다. */
    public synchronized PullsDTO pulls() {
        Instant now = clock.get();
        if (cached != null && cachedAt.plus(CACHE).isAfter(now)) return cached;
        try {
            String api = "https://api.github.com/repos/" + repo + "/pulls";
            var open = parse(fetch.apply(api + "?state=open&sort=created&direction=desc&per_page=" + OPEN_LIMIT), false);
            // 닫힌 PR 중 머지된 것만(머지 없이 닫힌 PR은 뺀다), 최근 갱신순
            var merged = parse(fetch.apply(api + "?state=closed&sort=updated&direction=desc&per_page=40"), true);
            merged.sort((a, b) -> b.mergedAt().compareTo(a.mergedAt()));
            cached = new PullsDTO(repo, open, List.copyOf(merged.subList(0, Math.min(MERGED_LIMIT, merged.size()))), now.toString(), false);
            cachedAt = now;
            return cached;
        } catch (RuntimeException exception) {
            log.warn("[github-pulls] fetch failed: {}", exception.getMessage());
            // 실패해도 1분은 다시 부르지 않는다(한도 보호).
            cachedAt = now.minus(CACHE).plus(Duration.ofMinutes(1));
            if (cached == null) cached = new PullsDTO(repo, List.of(), List.of(), null, true);
            else cached = new PullsDTO(cached.repo(), cached.open(), cached.merged(), cached.fetchedAt(), true);
            return cached;
        }
    }

    /** GitHub PR 목록 JSON을 읽는다. mergedOnly면 merged_at이 있는 것만 */
    static List<PullDTO> parse(String body, boolean mergedOnly) {
        JsonNode array = JSON.readTree(body);
        if (!array.isArray()) throw new IllegalStateException("Unexpected GitHub response");
        List<PullDTO> pulls = new ArrayList<>();
        for (JsonNode node : array) {
            String mergedAt = text(node, "merged_at");
            if (mergedOnly && mergedAt == null) continue;
            String url = text(node, "html_url");
            if (url == null || !url.startsWith("https://github.com/")) continue;
            String title = text(node, "title");
            pulls.add(new PullDTO(node.path("number").asInt(), title == null ? "" : title.length() > 200 ? title.substring(0, 200) : title,
                text(node.path("user"), "login"), node.path("draft").asBoolean(false), text(node, "created_at"), mergedAt, url));
        }
        return pulls;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isString() ? value.stringValue() : null;
    }
}
