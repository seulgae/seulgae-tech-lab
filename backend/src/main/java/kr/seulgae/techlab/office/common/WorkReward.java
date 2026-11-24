package kr.seulgae.techlab.office.common;

import java.util.UUID;
import kr.seulgae.techlab.inventory.service.InventoryService;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 서비스 연구실 게시판에서 일하기(글 등록·상태 변경)의 공통 비용과 보상.
 * 회원은 HP 3·기력 5가 남아 있어야 하고(모자라면 423), 일하면 HP -3·기력 -5에 동전 10원(하루 10번까지)을 받는다.
 *
 * @author 길태형
 * @version 1.0, 게시판 개편
 * @see None
 */
@Component
public class WorkReward {
    private final InventoryService inventory;

    public WorkReward(InventoryService inventory) { this.inventory = inventory; }

    /**
     * 일하기 전 기운 확인.
     *
     * @param author 회원(비회원이면 null, 확인하지 않음)
     * @exception ResponseStatusException 모자라면 423
     */
    public void ensureFit(UUID author, String action) { if (author != null) inventory.ensureFit(author, action); }

    /**
     * 일한 뒤 비용을 빼고 보상을 준다.
     *
     * @param author 회원(비회원이면 null, 아무것도 하지 않음)
     */
    public void reward(UUID author, String action) {
        if (author == null) return;
        try { inventory.spendWork(author, action); } catch (ResponseStatusException ignored) { /* 동시에 여러 번 일해 모자라졌으면 넘어간다 */ }
        inventory.rewardWorkPost(author);
    }
}
