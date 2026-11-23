package kr.seulgae.techlab.auth.dto;

import java.util.UUID;
import org.springframework.web.bind.annotation.*;


/**
 * 화면에 보여 줄 회원 정보
 * @param id 회원 ID
 * @param nickname 닉네임
 * @author seulgae
 * @version 1.0, 내 정보
 * @see "None"
 */
public record MemberViewDTO(UUID id, String nickname) {}
