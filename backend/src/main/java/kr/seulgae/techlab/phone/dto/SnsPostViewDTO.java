package kr.seulgae.techlab.phone.dto;

import java.time.OffsetDateTime;
import java.util.UUID;


/** 화면용 글: 작성자 id 대신 "내 글"인지만 알려 준다. */
public record SnsPostViewDTO(UUID id, String nickname, String content, OffsetDateTime createdAt, boolean mine) {}
