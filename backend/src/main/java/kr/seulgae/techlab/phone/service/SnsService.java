package kr.seulgae.techlab.phone.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.phone.dto.*;

/**
 * SnsService 기능 명세(구현: SnsServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see None
 */
public interface SnsService {
    int CONTENT_MAX = 140, DAILY_POSTS = 20, LIST_LIMIT = 50;

    List<SnsPostViewDTO> latest(UUID viewer);

    SnsPostViewDTO write(UUID author, String content);

    /** 글 지우기. 없으면 404, 내 글이 아니고 관리자도 아니면 403 */
    void delete(UUID member, UUID id, boolean admin);
}
