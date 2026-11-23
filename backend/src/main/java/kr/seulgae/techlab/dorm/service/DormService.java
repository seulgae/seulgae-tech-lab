package kr.seulgae.techlab.dorm.service;

import java.util.UUID;
import kr.seulgae.techlab.dorm.dto.DormViewDTO;

/**
 * 개인 기숙사 가구 기능 명세(구현: DormServiceImpl).
 * 가구점에서 동전으로 가구를 사면 보관함에 들어가고, 기숙사에 놓거나 다시 보관할 수 있다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
public interface DormService {
    /** 공통코드 COIN_REASON의 가구 구매 사유 */
    String FURNITURE_BUY = "FURNITURE_BUY";
    /** 회원 한 명이 가질 수 있는 가구 수 */
    int MAX_FURNITURE = 60;
    /** 기숙사 바닥 경계(벽 안쪽, px) */
    int FLOOR_LEFT = 24, FLOOR_RIGHT = 776, FLOOR_TOP = 64, FLOOR_BOTTOM = 576;
    /** 문 앞(아래 가운데)은 비워 둔다 */
    int DOOR_LEFT = 340, DOOR_RIGHT = 460, DOOR_TOP = 470;

    /**
     * 내 동전·카탈로그·가구를 읽는다.
     *
     * @param member 회원 ID
     * @return 기숙사 화면 값
     */
    DormViewDTO view(UUID member);

    /**
     * 가구를 사서 보관함에 넣는다(동전 차감).
     *
     * @param member 회원 ID
     * @param code 가구 코드
     * @return 기숙사 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 없는 가구 404, 동전 부족·보유 한도 409
     */
    DormViewDTO buy(UUID member, String code);

    /**
     * 보관함의 가구를 기숙사에 놓거나 이미 놓은 가구를 옮긴다.
     *
     * @param member 회원 ID
     * @param id 가구 ID
     * @param x 바닥 가운데 x
     * @param y 바닥 아래 끝 y
     * @return 기숙사 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 내 가구가 아니면 404, 벽 밖·문 앞·다른 가구와 겹치면 409
     */
    DormViewDTO place(UUID member, UUID id, Integer x, Integer y);

    /**
     * 놓인 가구를 보관함으로 되돌린다.
     *
     * @param member 회원 ID
     * @param id 가구 ID
     * @return 기숙사 화면 값
     * @exception org.springframework.web.server.ResponseStatusException 내 가구가 아니면 404
     */
    DormViewDTO store(UUID member, UUID id);
}
