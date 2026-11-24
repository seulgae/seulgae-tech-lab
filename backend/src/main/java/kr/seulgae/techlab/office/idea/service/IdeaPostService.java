package kr.seulgae.techlab.office.idea.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.office.idea.entity.IdeaPost;

/**
 * 아이디어 기획 게시판 명세(구현: IdeaPostServiceImpl): 게임 개발에 도움이 될 아이디어를 쓰고 읽는다.
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see "None"
 */
public interface IdeaPostService {
    int TITLE_MAX = 60, CONTENT_MAX = 1000, LIST_LIMIT = 50;

    /**
     * 최근 글 목록.
     *
     * @return 최대 50개
     */
    List<IdeaPost> list();

    /**
     * 글을 쓴다.
     *
     * @param title 제목
     * @param content 내용
     * @param author 쓴 회원(비회원이면 null)
     * @return 새 글
     * @exception org.springframework.web.server.ResponseStatusException 제목·내용 길이가 틀리면 400
     */
    IdeaPost create(String title, String content, UUID author);
}
