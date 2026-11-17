package kr.seulgae.techlab.lobby.guestbook;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 로비 방명록 저장소(V6 lab.guestbook_entries).
 *
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
public interface GuestbookStore {
    /** 방명록 글. author는 회원 닉네임(비회원·탈퇴 회원이면 null) */
    record Entry(UUID id, String category, String title, String content, String author, OffsetDateTime createdAt) {}

    /** 카테고리의 최신 글부터 limit개 */
    List<Entry> latest(String category, int limit);

    Entry insert(String category, String title, String content, UUID authorId);
}
