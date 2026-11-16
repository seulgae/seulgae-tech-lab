package kr.seulgae.techlab.common.write;

import java.util.Optional;
import java.util.UUID;

/**
 * 글의 소유 정보. 로그인 회원이 쓴 글은 작성자 ID로, 로그인 전 글은 수정 키로 소유를 확인한다.
 *
 * @param tokenHash 수정 키 해시, 없으면 빈 문자열
 * @param authorId 작성 회원 ID, 로그인 전 글이면 null
 * @author seulgae
 * @version 1.0, 작성자·수정 키 소유 확인
 * @see "None"
 */
public record Ownership(String tokenHash, UUID authorId) {
    /** 작성 회원 본인이거나, 이 브라우저가 가진 수정 키가 맞으면 허용한다. */
    public boolean allows(String token, Optional<UUID> member) {
        return member.isPresent() && member.get().equals(authorId) || EditTokens.matches(token, tokenHash);
    }
}
