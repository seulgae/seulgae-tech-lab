package kr.seulgae.techlab.inventory.dto;

import java.util.UUID;


/** 송금 받을 사람 */
public record RecipientDTO(UUID id, String nickname) {}
