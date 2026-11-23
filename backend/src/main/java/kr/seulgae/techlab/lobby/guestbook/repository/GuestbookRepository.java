package kr.seulgae.techlab.lobby.guestbook.repository;

import kr.seulgae.techlab.lobby.guestbook.entity.*;
import java.util.List;
import java.util.UUID;

/**
 * 로비 방명록 저장소(V6 lab.tb_lab_guestbook).
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
public interface GuestbookRepository {

    /** 카테고리의 최신 글부터 limit개 */
    List<Guestbook> latest(String category, int limit);

    Guestbook insert(String category, String title, String content, UUID authorId);
}
