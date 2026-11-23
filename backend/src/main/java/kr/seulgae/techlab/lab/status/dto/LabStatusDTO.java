package kr.seulgae.techlab.lab.status.dto;

import java.util.List;


/**
 * 서버실 랙 패널의 응답이다.
 * @author seulgae
 * @version 1.0, 집계 상태
 * @see "None"
 */
public record LabStatusDTO(String status, long uptimeSeconds, int onlinePlayers, int maxPlayers, List<RoomCountDTO> rooms, JvmMemoryDTO memory, String serverTime) {}
