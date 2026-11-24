package kr.seulgae.techlab.dorm.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.dorm.entity.Furniture;
import kr.seulgae.techlab.dorm.entity.MemberFurniture;

/**
 * 개인 기숙사 가구 저장소 명세(구현: JdbcDormRepository, 테스트: InMemoryDormRepository).
 * 회원 가구는 모든 쿼리를 member_id로 묶어 남의 가구는 보이지도 바뀌지도 않는다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see "None"
 */
public interface DormRepository {
    /**
     * 가구점 카탈로그를 표시 순서대로 읽는다.
     *
     * @return 가구 카탈로그
     */
    List<Furniture> catalog();

    /**
     * 회원이 가진 가구(보관·배치)를 산 순서대로 읽는다.
     *
     * @param member 회원 ID
     * @return 회원 가구 목록
     */
    List<MemberFurniture> owned(UUID member);

    /**
     * 산 가구를 보관함에 넣는다.
     *
     * @param member 회원 ID
     * @param code 가구 코드
     * @return 새 회원 가구
     */
    MemberFurniture add(UUID member, String code);

    /**
     * 내 가구를 (x, y)에 놓는다.
     *
     * @param member 회원 ID
     * @param id 가구 ID
     * @param x 바닥 가운데 x
     * @param y 바닥 아래 끝 y
     * @return 바뀐 가구(내 것이 아니면 빈 값)
     */
    Optional<MemberFurniture> place(UUID member, UUID id, int x, int y);

    /**
     * 내 가구를 보관함으로 되돌린다.
     *
     * @param member 회원 ID
     * @param id 가구 ID
     * @return 바뀐 가구(내 것이 아니면 빈 값)
     */
    Optional<MemberFurniture> store(UUID member, UUID id);
}
