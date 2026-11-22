package kr.seulgae.techlab.phone;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 폰 캘린더 할 일 저장소(V11 lab.todos). 회원은 자기 할 일만 읽고 바꾼다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(캘린더)
 * @see "None"
 */
public interface TodoStore {
    record Todo(UUID id, LocalDate date, String title, boolean done, OffsetDateTime createdAt) {}

    /** from~to(포함) 날짜의 할 일(날짜·만든 순) */
    List<Todo> between(UUID member, LocalDate from, LocalDate to);
    int count(UUID member);
    Todo insert(UUID member, LocalDate date, String title);
    /** 내 할 일의 완료 여부를 바꾼다. 내 것이 아니면 빈 값 */
    Optional<Todo> setDone(UUID member, UUID id, boolean done);
    /** @return 지운 행 수(내 것이 아니면 0) */
    int delete(UUID member, UUID id);
}
