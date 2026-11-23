package kr.seulgae.techlab.auth.dto;

import org.springframework.web.bind.annotation.*;


/**
 * 닉네임 변경 요청
 * @param nickname 새 닉네임
 * @author seulgae
 * @version 1.0, 닉네임 변경
 * @see "None"
 */
public record NicknameRequestDTO(String nickname) {}
