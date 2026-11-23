package kr.seulgae.techlab.lab.pulls.service;

import kr.seulgae.techlab.lab.pulls.dto.*;

/**
 * GithubPullsService 기능 명세(구현: GithubPullsServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface GithubPullsService {
    /** 캐시가 5분 안이면 그대로, 아니면 GitHub에서 다시 받는다. */
    PullsDTO pulls();
}
