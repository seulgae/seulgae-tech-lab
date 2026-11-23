package kr.seulgae.techlab.lab.pulls.service.impl;

import kr.seulgae.techlab.lab.pulls.dto.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * GitHub PR 목록: 열린 PR, 머지된 PR만 최근순, 5분 캐시, 실패하면 예전 목록을 오래됨 표시와 함께.
 * @author seulgae
 * @version 1.0, GitHub PR 목록
 * @see "None"
 */
class GithubPullsServiceTest {
    static final String OPEN = """
        [{"number":12,"title":"feat: 폰","draft":true,"created_at":"2026-11-22T01:00:00Z","merged_at":null,
          "html_url":"https://github.com/seulgae/seulgae-tech-lab/pull/12","user":{"login":"seulgae"}}]""";
    static final String CLOSED = """
        [{"number":10,"title":"closed only","created_at":"2026-11-20T00:00:00Z","merged_at":null,"html_url":"https://github.com/x/y/pull/10","user":{"login":"a"}},
         {"number":9,"title":"older","created_at":"2026-11-19T00:00:00Z","merged_at":"2026-11-19T05:00:00Z","html_url":"https://github.com/x/y/pull/9","user":{"login":"a"}},
         {"number":11,"title":"newer","created_at":"2026-11-21T00:00:00Z","merged_at":"2026-11-21T05:00:00Z","html_url":"https://github.com/x/y/pull/11","user":{"login":"b"}},
         {"number":8,"title":"evil","merged_at":"2026-11-21T06:00:00Z","html_url":"javascript:alert(1)","user":{"login":"c"}}]""";

    @Test void listsOpenAndMergedPullsAndCachesForFiveMinutes() {
        List<String> calls = new ArrayList<>();
        var now = new AtomicReference<>(Instant.parse("2026-11-23T10:00:00Z"));
        var service = new GithubPullsServiceImpl("seulgae/seulgae-tech-lab", url -> { calls.add(url); return url.contains("state=open") ? OPEN : CLOSED; }, now::get);
        var pulls = service.pulls();
        assertEquals(List.of(12), pulls.open().stream().map(PullDTO::number).toList());
        assertTrue(pulls.open().get(0).draft());
        assertEquals("seulgae", pulls.open().get(0).author());
        assertEquals(List.of(11, 9), pulls.merged().stream().map(PullDTO::number).toList(), "머지된 것만 최근순, github.com 링크만");
        assertFalse(pulls.stale());
        assertTrue(calls.get(0).startsWith("https://api.github.com/repos/seulgae/seulgae-tech-lab/pulls?state=open"));

        now.set(now.get().plusSeconds(299));
        service.pulls();
        assertEquals(2, calls.size(), "5분 안에는 다시 부르지 않는다");
        now.set(now.get().plusSeconds(2));
        service.pulls();
        assertEquals(4, calls.size());
    }

    @Test void keepsTheLastListWhenGithubFails() {
        var now = new AtomicReference<>(Instant.parse("2026-11-23T10:00:00Z"));
        var fail = new AtomicReference<>(false);
        var service = new GithubPullsServiceImpl("seulgae/seulgae-tech-lab", url -> {
            if (fail.get()) throw new IllegalStateException("GitHub responded 403");
            return url.contains("state=open") ? OPEN : CLOSED;
        }, now::get);
        service.pulls();
        fail.set(true);
        now.set(now.get().plusSeconds(600));
        var stale = service.pulls();
        assertTrue(stale.stale());
        assertEquals(1, stale.open().size(), "예전 목록을 그대로 보여 준다");
        assertThrows(IllegalArgumentException.class, () -> new GithubPullsServiceImpl("../etc", url -> "", Instant::now));
    }
}
