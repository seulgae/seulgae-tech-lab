package kr.seulgae.techlab.office.idea.entity;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 아이디어 기획 게시판 글(tb_lab_idea_post). author는 쓴 회원 닉네임(비회원·탈퇴는 null).
 *
 * @author 길태형
 * @version 1.0, 아이디어 기획 게시판
 * @see "None"
 */
public record IdeaPost(UUID id, String title, String content, String author, OffsetDateTime createdAt) {}
