package kr.seulgae.techlab.office.common;

import java.util.UUID;
import kr.seulgae.techlab.inventory.service.InventoryService;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 서비스 연구실 게시판에서 일하기(글 등록·상태 변경)의 공통 비용과 보상.
 * 행동 코드별 서버 규칙으로 HP·기력 비용을 확인하고, 하루 한도 안에서 게시판 동전 보상을 지급한다.
 *
 * @author 길태형
 * @version 1.0, 게시판 개편
 * @see InventoryService
 */
@Component
public class WorkReward {
    private final InventoryService inventory;

    public WorkReward(InventoryService inventory) { this.inventory = inventory; }

    /**
     * 게시판 작업 전에 행동별 HP·기력 비용을 감당할 수 있는지 확인한다.
     *
     * @param author 회원(비회원이면 null, 확인하지 않음)
     * @param action 행동 비용 조회에 쓸 코드
     * @throws ResponseStatusException HP 또는 기력이 부족할 때
     */
    public void ensureFit(UUID author, String action) { if (author != null) inventory.ensureFit(author, action); }

    /**
     * 작업 후 행동 비용을 차감하고, 일일 한도에 따라 동전 보상을 지급한다.
     * 비용 확인과 차감 사이에 다른 요청이 먼저 재화를 사용해 차감이 거절되어도 보상 처리는 이어 간다.
     *
     * @param author 작업한 회원 ID. 비회원이면 null
     * @param action 차감할 행동 비용 코드
     */
    public void reward(UUID author, String action) {
        if (author == null) return;
        try { inventory.spendWork(author, action); } catch (ResponseStatusException ignored) { /* 동시에 여러 번 일해 모자라졌으면 넘어간다 */ }
        inventory.rewardWorkPost(author);
    }
}
