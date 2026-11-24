package kr.seulgae.techlab.office.idea.repository;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.office.idea.entity.IdeaPost;

/**
 * 아이디어 기획 게시판 저장소 명세(구현: JdbcIdeaPostRepository, 테스트: InMemoryIdeaPostRepository).
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see "None"
 */
public interface IdeaPostRepository {
    /**
     * 최근 글부터 읽는다.
     *
     * @param limit 최대 개수
     * @return 글 목록
     */
    List<IdeaPost> recent(int limit);

    /**
     * 글을 쓴다.
     *
     * @param author 쓴 회원(비회원이면 null)
     * @param title 제목
     * @param content 내용
     * @return 새 글
     */
    IdeaPost create(UUID author, String title, String content);
}
