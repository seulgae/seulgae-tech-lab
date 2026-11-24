package kr.seulgae.techlab.rule.controller;

import kr.seulgae.techlab.rule.service.GameRules;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 게임 규칙 API(누구나 읽음): 화면이 비용·간식·직급 숫자를 코드에 따로 두지 않고 이 값을 쓴다.
 *
 * @author 길태형
 * @version 1.0, 게임 규칙 테이블
 * @see "None"
 */
@RestController
@RequestMapping("/api/rules")
public class RuleController {
    private final GameRules rules;

    public RuleController(GameRules rules) { this.rules = rules; }

    /**
     * 행동 비용·간식·직급.
     *
     * @return 규칙 묶음
     */
    @GetMapping
    public GameRules.Rules rules() { return rules.rules(); }
}
