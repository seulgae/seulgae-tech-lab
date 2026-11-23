package kr.seulgae.techlab.phone.repository;

import kr.seulgae.techlab.phone.entity.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 폰 SNS 글 저장소(V11 lab.tb_lab_sns_post).
 *
 * @author seulgae
 * @version 1.0, 폰 앱(SNS)
 * @see "None"
 */
public interface SnsRepository {

    /** 최근 글(최근순) */
    List<SnsPost> latest(int limit);
    SnsPost insert(UUID author, String content);
    /** 오늘(한국 시간) 이 회원이 쓴 글 수 */
    int countToday(UUID author);
    Optional<UUID> author(UUID id);
    int delete(UUID id);
}
