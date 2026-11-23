package kr.seulgae.techlab.phone.dto;

import org.springframework.web.bind.annotation.*;


/**
 * 화면·API로 주고받는 값(TodoDoneRequestDTO에서 분리).
 *
 * @author 길태형
 * @version 1.0, 계층별 패키지 정리
 * @see None
 */
public record TodoDoneRequestDTO(Boolean done) {}
