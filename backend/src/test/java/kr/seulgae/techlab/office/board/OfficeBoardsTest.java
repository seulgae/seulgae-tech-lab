package kr.seulgae.techlab.office.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.impl.InMemoryInventoryRepository;
import kr.seulgae.techlab.office.desk.service.impl.DeskServiceImpl;
import kr.seulgae.techlab.office.desk.service.impl.JavaProblems;
import kr.seulgae.techlab.office.idea.service.impl.IdeaPostServiceImpl;
import kr.seulgae.techlab.office.qa.service.impl.QaTicketServiceImpl;
import org.junit.jupiter.api.Test;

/**
 * 서비스 연구실 개편: 아이디어 글, QA 티켓 상태 흐름(앞으로만), 내 자리 오늘 업무·보상, 자바 printf 채점.
 *
 * @author 길태형
 * @version 1.0, 게시판 개편
 * @see None
 */
class OfficeBoardsTest {
    private final UUID me = UUID.randomUUID();

    @Test
    void ideasAreTrimmedAndNewestFirst() {
        var ideas = new IdeaPostServiceImpl(new InMemoryOfficeBoards.Ideas());
        ideas.create("  첫 아이디어 ", "낚시 대회", me);
        ideas.create("둘째", "오락실 랭킹", null);
        assertThat(ideas.list()).extracting("title").containsExactly("둘째", "첫 아이디어");
        assertThatThrownBy(() -> ideas.create(" ", "내용", me)).hasMessageContaining("400");
        assertThatThrownBy(() -> ideas.create("제목", "가".repeat(1001), me)).hasMessageContaining("400");
    }

    @Test
    void qaTicketsOnlyMoveForward() {
        var qa = new QaTicketServiceImpl(new InMemoryOfficeBoards.Tickets());
        var ticket = qa.create("버튼이 안 눌려요", "로비 방명록 버튼", me);
        assertThat(ticket.status()).isEqualTo("REGISTERED");
        assertThat(qa.move(ticket.id(), "IN_PROGRESS").statusName()).isEqualTo("조치 중");
        assertThatThrownBy(() -> qa.move(ticket.id(), "IN_PROGRESS")).hasMessageContaining("409");
        assertThatThrownBy(() -> qa.move(ticket.id(), "REGISTERED")).hasMessageContaining("400");
        assertThat(qa.move(ticket.id(), "RESOLVED").status()).isEqualTo("RESOLVED");
        assertThatThrownBy(() -> qa.move(UUID.randomUUID(), "RESOLVED")).hasMessageContaining("404");
        var skip = qa.create("바로 완료", "작은 오타", me);
        assertThat(qa.move(skip.id(), "RESOLVED").status()).isEqualTo("RESOLVED");
    }

    @Test
    void dailyTasksAreCheckedFromRecordsAndRewardOnce() {
        var inventory = new InMemoryInventoryRepository();
        var desk = new DeskServiceImpl(inventory, Clock.fixed(Instant.parse("2026-11-24T03:00:00Z"), ZoneId.of("Asia/Seoul")));
        assertThat(desk.view(me).tasks()).noneMatch(task -> task.done());
        assertThatThrownBy(() -> desk.claim(me)).hasMessageContaining("409");
        inventory.changeCoins(me, 20, "TEST");
        inventory.changeCoins(me, 0, "FISH_SALE");
        inventory.changeCoins(me, -1, "ARCADE_PLAY");
        inventory.changeCoins(me, -2, "COFFEE");
        inventory.changeCoins(me, 10, "WORK_POST");
        assertThat(desk.view(me).tasks()).filteredOn(task -> !task.done()).extracting("code").containsExactly("JAVA");
        var answer = desk.answer(me, "sum", "%d + %d = %d");
        assertThat(answer.correct()).isTrue();
        assertThat(answer.rewarded()).isTrue();
        int before = desk.view(me).coins();
        assertThat(desk.claim(me).rewardClaimed()).isTrue();
        assertThat(desk.view(me).coins()).isEqualTo(before + 5);
        assertThatThrownBy(() -> desk.claim(me)).hasMessageContaining("Already");
    }

    @Test
    void javaAnswersAreGradedByRealFormatter() {
        var inventory = new InMemoryInventoryRepository();
        var desk = new DeskServiceImpl(inventory);
        for (var problem : JavaProblems.ALL) assertThat(problem.view().expected()).isNotBlank();
        assertThat(desk.answer(me, "hello", "안녕하세요, %s 연구원!").correct()).isTrue();
        assertThat(desk.answer(me, "pi", "원주율: %.2f").output()).isEqualTo("원주율: 3.14");
        assertThat(desk.answer(me, "width", "[%3d]").correct()).isTrue();
        assertThat(desk.answer(me, "zero", "No.%03d").correct()).isTrue();
        assertThat(desk.answer(me, "menu", "%-6s|%4d원").correct()).isTrue();
        assertThat(desk.answer(me, "percent", "진행률 %d%%").correct()).isTrue();
        assertThat(desk.view(me).javaRewardsToday()).isEqualTo(3);
        var wrong = desk.answer(me, "sum", "%d+%d=%d");
        assertThat(wrong.correct()).isFalse();
        assertThat(wrong.output()).isEqualTo("3+5=8");
        assertThat(desk.answer(me, "sum", "%d %q").error()).isNotBlank();
        assertThat(desk.answer(me, "width", "%999999d").error()).contains("두 자리");
        assertThatThrownBy(() -> desk.answer(me, "nope", "%d")).hasMessageContaining("404");
    }
}
