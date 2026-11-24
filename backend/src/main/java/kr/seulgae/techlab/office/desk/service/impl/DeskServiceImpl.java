package kr.seulgae.techlab.office.desk.service.impl;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.IllegalFormatException;
import java.util.List;
import java.util.UUID;
import kr.seulgae.techlab.inventory.repository.InventoryRepository;
import kr.seulgae.techlab.inventory.service.InventoryService;
import kr.seulgae.techlab.office.desk.dto.DailyTaskDTO;
import kr.seulgae.techlab.office.desk.dto.DeskViewDTO;
import kr.seulgae.techlab.office.desk.dto.JavaAnswerDTO;
import kr.seulgae.techlab.office.desk.service.DeskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 내 자리 컴퓨터 구현. 오늘 업무는 따로 저장하지 않고 오늘 동전 기록(사유별 횟수)과 오늘 낚은 물고기로 계산한다.
 *
 * @author 길태형
 * @version 1.0, 내 자리 컴퓨터
 * @see None
 */
@Service
public class DeskServiceImpl implements DeskService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final InventoryRepository inventory;
    private final Clock clock;

    @Autowired
    public DeskServiceImpl(InventoryRepository inventory) { this(inventory, Clock.system(SEOUL)); }

    public DeskServiceImpl(InventoryRepository inventory, Clock clock) { this.inventory = inventory; this.clock = clock; }

    @Override
    public DeskViewDTO view(UUID member) {
        return new DeskViewDTO(tasks(member), DAILY_REWARD, inventory.countToday(member, DAILY_TASKS) > 0,
            JavaProblems.ALL.stream().map(JavaProblems.Problem::view).toList(), inventory.countToday(member, JAVA_PRACTICE), JAVA_DAILY_REWARDS,
            inventory.coins(member));
    }

    /**
     * 오늘 업무 다섯 가지와 했는지.
     *
     * @param member 회원 ID
     * @return 업무 목록
     */
    List<DailyTaskDTO> tasks(UUID member) {
        LocalDate today = LocalDate.now(clock.withZone(SEOUL));
        boolean fished = inventory.countToday(member, InventoryService.FISH_SALE) > 0 || inventory.owned(member).stream()
            .anyMatch(item -> "FISH".equals(item.kind()) && item.createdAt().atZoneSameInstant(SEOUL).toLocalDate().equals(today));
        return List.of(
            new DailyTaskDTO("FISHING", "물고기 한 마리 낚기", "바깥 강가 낚시 데크", fished),
            new DailyTaskDTO("ARCADE", "오락실 게임 한 판 하기", "로비 왼쪽 아래 오락실", inventory.countToday(member, InventoryService.ARCADE_PLAY) > 0),
            new DailyTaskDTO("COFFEE", "커피 한 잔 마시기", "로비 데스크", inventory.countToday(member, "COFFEE") > 0),
            new DailyTaskDTO("BOARD", "게시판에 글 하나 올리기", "아이디어 기획·QA 게시판", inventory.countToday(member, InventoryService.WORK_POST) > 0),
            new DailyTaskDTO("JAVA", "자바 printf 문제 하나 풀기", "내 자리 컴퓨터 개발 아이콘", inventory.countToday(member, JAVA_PRACTICE) > 0));
    }

    @Override
    @Transactional
    public DeskViewDTO claim(UUID member) {
        if (!tasks(member).stream().allMatch(DailyTaskDTO::done)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Tasks not done");
        if (inventory.countToday(member, DAILY_TASKS) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Already claimed");
        inventory.changeCoins(member, DAILY_REWARD, DAILY_TASKS).orElseThrow();
        return view(member);
    }

    @Override
    @Transactional
    public JavaAnswerDTO answer(UUID member, String problemId, String format) {
        var problem = JavaProblems.ALL.stream().filter(entry -> entry.view().id().equals(problemId)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown problem"));
        if (format == null || format.isEmpty() || format.length() > FORMAT_MAX) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "format must be 1-" + FORMAT_MAX + " characters");
        String output;
        try { output = JavaProblems.render(format, problem.args()); }
        catch (IllegalFormatException exception) { return new JavaAnswerDTO(problemId, format, null, false, false, JavaProblems.explain(exception, problem.args())); }
        catch (IllegalArgumentException exception) { return new JavaAnswerDTO(problemId, format, null, false, false, exception.getMessage()); }
        boolean correct = output.equals(problem.view().expected());
        /* 맞히면 동전 1원, 하루 3번까지(같은 문제를 다시 풀어도 센다) */
        boolean rewarded = correct && inventory.countToday(member, JAVA_PRACTICE) < JAVA_DAILY_REWARDS
            && inventory.changeCoins(member, JAVA_REWARD, JAVA_PRACTICE).isPresent();
        return new JavaAnswerDTO(problemId, format, output, correct, rewarded, null);
    }
}
