package kr.seulgae.techlab.dorm.dto;

import java.util.List;
import kr.seulgae.techlab.dorm.entity.Furniture;
import kr.seulgae.techlab.dorm.entity.MemberFurniture;

/**
 * 개인 기숙사·가구점 화면 값: 내 동전, 가구 카탈로그, 내가 가진 가구(보관·배치 모두).
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see None
 */
public record DormViewDTO(int coins, List<Furniture> catalog, List<MemberFurniture> furniture) {}
