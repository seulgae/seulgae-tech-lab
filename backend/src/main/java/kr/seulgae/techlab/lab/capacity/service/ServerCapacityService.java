package kr.seulgae.techlab.lab.capacity.service;

import kr.seulgae.techlab.lab.capacity.dto.*;

/**
 * ServerCapacityService 기능 명세(구현: ServerCapacityServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see "None"
 */
public interface ServerCapacityService {
    /** 이 값을 넘으면 화면에 경고(블로그 글의 운영 기준과 같은 80%) */
    double WARN_PERCENT = 80;

    /** 30초마다(첫 수집은 시작 5초 뒤) 호스트 프로브를 돌린다. 실패해도 마지막 성공 값은 지우지 않는다. */
    void collect();

    CapacityReportDTO report();
}
