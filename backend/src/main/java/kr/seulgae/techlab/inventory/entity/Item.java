package kr.seulgae.techlab.inventory.entity;

import java.time.OffsetDateTime;
import java.util.UUID;


/**
 * 아이템. 주인이 있으면 인벤토리에 있고(roomId·x·y는 null), 주인이 없으면 방 바닥에 놓여 있다.
 * @param kind 공통코드 ITEM_KIND(FISH)
 */
public record Item(UUID id, String kind, String name, Integer sizeCm, String roomId, Double x, Double y, OffsetDateTime createdAt) {}
