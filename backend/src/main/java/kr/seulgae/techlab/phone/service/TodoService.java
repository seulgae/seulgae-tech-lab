package kr.seulgae.techlab.phone.service;

import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.phone.entity.*;

/**
 * TodoService 기능 명세(구현: TodoServiceImpl).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(서비스 인터페이스 분리)
 * @see "None"
 */
public interface TodoService {
    int TITLE_MAX = 40, MAX_TODOS = 300;

    /** 이 달(YYYY-MM)의 할 일 */
    List<Todo> month(UUID member, String month);

    Todo add(UUID member, String date, String title);

    Todo done(UUID member, UUID id, Boolean done);

    void delete(UUID member, UUID id);
}
