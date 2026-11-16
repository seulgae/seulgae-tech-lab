package kr.seulgae.techlab.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 회원 저장소와 회원이 쓴 글 ID 조회(내 글 표시용)이다.
 *
 * @author seulgae
 * @version 1.0, lab.members 접근
 * @see "None"
 */
@Repository
public class MemberRepository {
    private final JdbcClient jdbc;
    public MemberRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<Member> findById(UUID id) {
        return jdbc.sql("SELECT id, kakao_id, nickname FROM lab.members WHERE id = :id").param("id", id)
            .query((rs, row) -> new Member(rs.getObject("id", UUID.class), rs.getLong("kakao_id"), rs.getString("nickname"))).optional();
    }

    /** 이미 있는 회원이면 마지막 로그인 시각만 갱신한다. */
    public Optional<Member> loginByKakaoId(long kakaoId) {
        return jdbc.sql("UPDATE lab.members SET last_login_at = CURRENT_TIMESTAMP WHERE kakao_id = :kakaoId RETURNING id, kakao_id, nickname")
            .param("kakaoId", kakaoId)
            .query((rs, row) -> new Member(rs.getObject("id", UUID.class), rs.getLong("kakao_id"), rs.getString("nickname"))).optional();
    }

    public Member create(UUID id, long kakaoId, String nickname) {
        jdbc.sql("INSERT INTO lab.members (id, kakao_id, nickname) VALUES (:id, :kakaoId, :nickname)")
            .param("id", id).param("kakaoId", kakaoId).param("nickname", nickname).update();
        return new Member(id, kakaoId, nickname);
    }

    public void updateNickname(UUID id, String nickname) {
        jdbc.sql("UPDATE lab.members SET nickname = :nickname WHERE id = :id").param("id", id).param("nickname", nickname).update();
    }

    /** 최근에 쓴 글 ID(최대 200개). 화면에서 "내 글"과 수정·삭제 버튼을 표시하는 데 쓴다. */
    public List<UUID> recentRecordIds(UUID memberId) {
        return jdbc.sql("SELECT id FROM lab.research_records WHERE author_id = :id ORDER BY created_at DESC LIMIT 200")
            .param("id", memberId).query(UUID.class).list();
    }

    public List<UUID> recentAgendaIds(UUID memberId) {
        return jdbc.sql("SELECT id FROM lab.meeting_agendas WHERE author_id = :id ORDER BY created_at DESC LIMIT 200")
            .param("id", memberId).query(UUID.class).list();
    }
}
