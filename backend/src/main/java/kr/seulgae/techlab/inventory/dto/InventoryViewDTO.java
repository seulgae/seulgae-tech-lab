package kr.seulgae.techlab.inventory.dto;

import java.util.List;
import kr.seulgae.techlab.inventory.entity.*;

/** 인벤토리 화면 */
public record InventoryViewDTO(int coins, List<Item> items, int rewardsLeftToday, int hp, int hpMax, int fatigue, int fatigueMax) {}
