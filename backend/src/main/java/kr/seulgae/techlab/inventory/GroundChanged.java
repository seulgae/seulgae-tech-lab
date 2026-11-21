package kr.seulgae.techlab.inventory;

import java.util.List;

/**
 * 방 바닥 아이템이 바뀌었다(버리기·줍기). 회의실처럼 연결된 사람이 있는 방은 실시간으로 다시 보여 준다.
 *
 * @param roomId 방
 * @param items 지금 바닥 목록
 * @author seulgae
 * @version 1.0, 회의실 아이템 교환
 * @see "None"
 */
public record GroundChanged(String roomId, List<InventoryService.GroundItem> items) {}
