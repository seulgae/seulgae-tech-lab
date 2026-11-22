package kr.seulgae.techlab.recruitment;

import java.time.*;
import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import kr.seulgae.techlab.admin.AdminAccess;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;

/**
 * 개인 채용정보와 수동 실행·근거 보완을 관리자 세션으로 보호한다.
 * @author seulgae
 * @version 1.0, NPC 상태와 채용관리 API
 * @see "None"
 */
@RestController
@RequestMapping("/api/recruitment")
public class RecruitmentController {
    private final AdminAccess access;
    private final RecruitmentStore store;
    private final RecruitmentJobs jobs;
    private final RecruitmentInbox inbox;
    public RecruitmentController(AdminAccess access,RecruitmentStore store,RecruitmentJobs jobs,RecruitmentInbox inbox) {this.access=access;this.store=store;this.jobs=jobs;this.inbox=inbox;}
    /** NPC 공개 상태는 개인정보·오류 세부 내용 없이 오늘 업무 상태만 제공한다. */
    @GetMapping("/agents")
    public Map<String,Object> agents() {
        if(!jobs.enabled) return Map.of("enabled",false,"jobs",List.of());
        var date=LocalDate.now(RecruitmentJobs.SEOUL);
        return Map.of("enabled",true,"jobs",store.jdbc.sql("SELECT task,state,processed,started_at,finished_at FROM lab.recruitment_agent_job WHERE work_date=:date")
            .param("date",date).query().listOfRows());
    }
    @GetMapping
    public Map<String,Object> dashboard(HttpServletRequest request) {require(request);return store.dashboard(LocalDate.now(RecruitmentJobs.SEOUL));}
    /** 수동 실행도 예약 작업과 동일한 락·의존성·멱등성 검사를 수행한다. */
    @PostMapping("/jobs/{task}")
    public Map<String,Object> run(@PathVariable String task,@RequestParam(required=false) LocalDate date,HttpServletRequest request) {
        require(request);jobs.run(date==null?LocalDate.now(RecruitmentJobs.SEOUL):date,task,true);return dashboard(request);
    }
    /** 관리자가 직접 확인한 필드별 근거를 저장한다. 원본 문구와 URL·확인 시각은 필수다. */
    @PutMapping("/collections/{id}/evidence")
    public Map<String,Object> evidence(@PathVariable UUID id,@RequestBody JsonNode facts,HttpServletRequest request) {
        require(request);
        if(!facts.isObject() || facts.toString().length()>16000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid evidence");
        for(String field:List.of("javaBackend","companyType","employees","rating","probationMonths","accepting","deadline"))
            if(facts.has(field) && !RecruitmentRules.evidence(facts.path(field),field,Instant.now())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid field evidence");
        try {jobs.updateEvidence(id,facts);}
        catch(NoSuchElementException e) {throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Collection not found");}
        return dashboard(request);
    }
    /** 관리자 로그인으로 정형 공고 배열을 접수한다. 토큰 경로와 같은 한도·중복 규칙을 적용한다. */
    @PostMapping("/imports")
    public Map<String,Object> ingest(@RequestBody JsonNode items,HttpServletRequest request) {require(request);return inbox.ingest(items);}
    /** 읽음·확인·지원·보류는 사용자 관리자 세션으로만 변경한다. */
    @PatchMapping("/reviews/{id}")
    public Map<String,Object> transition(@PathVariable UUID id,@RequestBody Map<String,String> body,HttpServletRequest request) {
        require(request);inbox.transition(id,body.get("state"),access.require(request));return dashboard(request);
    }
    private void require(HttpServletRequest request) {access.require(request);if(!jobs.enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Recruitment disabled");}
}
