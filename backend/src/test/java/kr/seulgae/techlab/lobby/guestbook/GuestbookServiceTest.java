package kr.seulgae.techlab.lobby.guestbook;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 방명록: 제목 8자·내용 130자 제한(글자 단위, 앞뒤 공백 제외)과 최신순 목록.
 * @author seulgae
 * @version 1.0, 로비 방명록
 * @see "None"
 */
class GuestbookServiceTest {
    private final GuestbookService service = new GuestbookService(new InMemoryGuestbookStore());

    @Test void writesTrimmedEntriesNewestFirst() {
        service.write(" 안녕하세요 ", "  처음 와 봤어요 ", null);
        var second = service.write("반가워요", "로비가 예뻐요", UUID.randomUUID());
        var list = service.latest();
        assertEquals(2, list.size());
        assertEquals(second.id(), list.get(0).id(), "최신 글이 먼저");
        assertEquals("안녕하세요", list.get(1).title());
        assertEquals("처음 와 봤어요", list.get(1).content());
        assertEquals("GUESTBOOK", list.get(0).category());
        assertNull(list.get(1).author(), "비회원 글은 작성자 없음");
    }

    @Test void titleIsLimitedToEightAndContentTo130Characters() {
        assertDoesNotThrow(() -> service.write("12345678", "가".repeat(130), null));
        assertDoesNotThrow(() -> service.write("😀😀😀😀😀😀😀😀", "😀".repeat(130), null), "이모지도 한 글자로 센다");
        assertThrows(ResponseStatusException.class, () -> service.write("123456789", "내용", null));
        assertThrows(ResponseStatusException.class, () -> service.write("제목", "가".repeat(131), null));
        assertThrows(ResponseStatusException.class, () -> service.write("   ", "내용", null));
        assertThrows(ResponseStatusException.class, () -> service.write("제목", null, null));
    }
}
