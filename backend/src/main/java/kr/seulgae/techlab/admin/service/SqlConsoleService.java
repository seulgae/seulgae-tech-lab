package kr.seulgae.techlab.admin.service;

import java.util.List;
import kr.seulgae.techlab.admin.dto.*;

/**
 * SqlConsoleService 기능 명세(구현: SqlConsoleServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see "None"
 */
public interface SqlConsoleService {
    int MAX_ROWS = 200, MAX_CELL = 1000, MAX_SQL = 10_000;
    String TIMEOUT = "5s";

    SqlResultDTO run(String sql);

    /** 앱 DB 계정이 볼 수 있는 모든 테이블·뷰(시스템 스키마 제외) */
    List<TableInfoDTO> tables();
}
