package kr.seulgae.techlab.phone;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 폰 캘린더 할 일 규칙: 제목 1~40자, 날짜는 오늘(한국 시간)에서 앞뒤 1년 안, 회원당 300개까지.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(캘린더)
 * @see "None"
 */
@Service
public class TodoService {
    public static final int TITLE_MAX = 40, MAX_TODOS = 300;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final TodoStore store;
    private final Clock clock;

    @Autowired
    public TodoService(TodoStore store) { this(store, Clock.system(SEOUL)); }

    /** 테스트용: 오늘을 바꿔 끼운다. */
    TodoService(TodoStore store, Clock clock) { this.store = store; this.clock = clock; }

    /** 이 달(YYYY-MM)의 할 일 */
    public List<TodoStore.Todo> month(UUID member, String month) {
        YearMonth value;
        try { value = YearMonth.parse(month == null ? "" : month); }
        catch (DateTimeParseException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must be YYYY-MM"); }
        return store.between(member, value.atDay(1), value.atEndOfMonth());
    }

    public TodoStore.Todo add(UUID member, String date, String title) {
        LocalDate day;
        try { day = LocalDate.parse(date == null ? "" : date); }
        catch (DateTimeParseException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must be YYYY-MM-DD"); }
        LocalDate today = LocalDate.now(clock.withZone(SEOUL));
        if (day.isBefore(today.minusYears(1)) || day.isAfter(today.plusYears(1))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date out of range");
        String text = title == null ? "" : title.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > TITLE_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title must be 1-" + TITLE_MAX + " characters");
        if (store.count(member) >= MAX_TODOS) throw new ResponseStatusException(HttpStatus.CONFLICT, "Too many todos");
        return store.insert(member, day, text);
    }

    public TodoStore.Todo done(UUID member, UUID id, Boolean done) {
        if (done == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "done required");
        return store.setDone(member, id, done).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found"));
    }

    public void delete(UUID member, UUID id) {
        if (store.delete(member, id) != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found");
    }
}
