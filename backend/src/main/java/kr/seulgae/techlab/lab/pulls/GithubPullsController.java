package kr.seulgae.techlab.lab.pulls;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 개발 연구실 슈퍼컴퓨터의 GitHub PR 목록 API(공개 저장소의 공개 정보만).
 *
 * @author seulgae
 * @version 1.0, GitHub PR 목록
 * @see "None"
 */
@RestController
@RequestMapping("/api/lab")
public class GithubPullsController {
    private final GithubPullsService service;

    public GithubPullsController(GithubPullsService service) { this.service = service; }

    /** @return 열린 PR(최대 20)과 최근 머지된 PR(최대 15). 서버가 5분 캐시한다. */
    @GetMapping("/pulls")
    public ResponseEntity<GithubPullsService.Pulls> pulls() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.pulls());
    }
}
