package kr.seulgae.techlab.recruitment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

/**
 * 채용 접수만 허용하는 전용 토큰 API다. 임의 SQL이나 지원 상태 변경은 허용하지 않는다.
 * @author seulgae
 * @version 1.0, 정형 공고 외부 등록 API
 * @see "None"
 */
@RestController
@RequestMapping("/api/recruitment/intake")
public class RecruitmentIntakeController {
    private final RecruitmentInbox inbox;
    private final RecruitmentJobs jobs;
    private final String token;
    public RecruitmentIntakeController(RecruitmentInbox inbox,RecruitmentJobs jobs,
        @Value("${lab.recruitment.intake-token:}") String token) {this.inbox=inbox;this.jobs=jobs;this.token=token;}
    /** 토큰은 헤더로만 받고 기록하지 않는다. 키가 없으면 외부 등록 경로는 닫혀 있다. */
    @PostMapping
    public Map<String,Object> ingest(@RequestHeader(value="Authorization",required=false) String authorization,@RequestBody JsonNode items) {
        if(!jobs.enabled || token.length()<32) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Intake not configured");
        if(authorization==null || !MessageDigest.isEqual(("Bearer "+token).getBytes(StandardCharsets.UTF_8),authorization.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid intake token");
        return inbox.ingest(items);
    }
}
