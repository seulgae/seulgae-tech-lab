package kr.seulgae.techlab.inventory.dto;

import org.springframework.web.bind.annotation.*;


/** 버리기·줍기: 아이템, 방, 지금 내 위치(회의실 밖은 서버가 위치를 모르므로 클라이언트가 알려 준다) */
public record ItemRequestDTO(String itemId, String room, Double x, Double y) {}
