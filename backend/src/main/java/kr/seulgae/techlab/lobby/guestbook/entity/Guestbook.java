package kr.seulgae.techlab.lobby.guestbook.entity;

import java.time.OffsetDateTime;
import java.util.UUID;


/** 방명록 글. author는 회원 닉네임(비회원·탈퇴 회원이면 null) */
public record Guestbook(UUID id, String category, String title, String content, String author, OffsetDateTime createdAt) {}
