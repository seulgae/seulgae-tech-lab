package kr.seulgae.techlab.auth.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.seulgae.techlab.auth.entity.*;

/**
 * MemberRepository 저장소 명세(구현: JdbcMemberRepository).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리(저장소 인터페이스 분리)
 * @see "None"
 */
public interface MemberRepository {
    Optional<Member> findById(UUID id);

    /** 이미 있는 회원이면 마지막 로그인 시각만 갱신한다. */
    Optional<Member> loginByKakaoId(long kakaoId);

    Member create(UUID id, long kakaoId, String nickname);

    void updateNickname(UUID id, String nickname);

    /** 최근에 쓴 회의 안건 ID(최대 200개). 화면에서 "내 글"과 수정·삭제 버튼을 표시하는 데 쓴다. */
    List<UUID> recentAgendaIds(UUID memberId);
}
