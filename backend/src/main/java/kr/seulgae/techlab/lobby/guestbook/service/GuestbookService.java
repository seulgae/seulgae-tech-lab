package kr.seulgae.techlab.lobby.guestbook.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.lobby.guestbook.entity.*;

/**
 * GuestbookService 기능 명세(구현: GuestbookServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see "None"
 */
public interface GuestbookService {
    /** 공통코드 BOARD_CATEGORY의 방명록 카테고리 */
    String GUESTBOOK = "GUESTBOOK";
    int TITLE_MAX = 8;
    int CONTENT_MAX = 130;

    List<Guestbook> latest();

    Guestbook write(String title, String content, UUID author);
}
