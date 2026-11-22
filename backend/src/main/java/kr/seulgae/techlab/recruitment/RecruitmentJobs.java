package kr.seulgae.techlab.recruitment;

import java.time.*;
import java.sql.Connection;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/**
 * 한국 날짜별 업무를 DB 세션 락으로 직렬화한다. 재시작 시 남은 WORKING 작업도 동일 락 아래 재실행한다.
 * @author seulgae
 * @version 1.0, 예약·수동·보완 실행과 재시도
 * @see "None"
 */
@Service
public class RecruitmentJobs {
    static final ZoneId SEOUL=ZoneId.of("Asia/Seoul");
    static final List<String> TASKS=List.of("SEARCH","CHECK","REGISTER","REPORT");
    private final RecruitmentStore store;
    private final RecruitmentInbox inbox;
    final boolean enabled;
    public RecruitmentJobs(RecruitmentStore store,RecruitmentInbox inbox,
        @Value("${lab.recruitment.enabled:true}") boolean enabled) {
        this.store=store;this.inbox=inbox;this.enabled=enabled;
    }
    /** 수신된 공고를 재시작 뒤에도 처리하고 마감일을 매분 확인한다. 외부 검색 API는 호출하지 않는다. */
    @Scheduled(fixedDelay=60000,initialDelay=15000,scheduler="recruitmentScheduler")
    public void tick() {
        if(!enabled) return;
        try {
            inbox.adoptLegacy();
            inbox.purgeExpired();
            for(String task:TASKS) run(LocalDate.now(SEOUL),task,false);
        } catch(Exception e) {org.slf4j.LoggerFactory.getLogger(getClass()).warn("Recruitment inbox cycle failed ({})",e.getClass().getSimpleName());}
    }
    /** 같은 서비스로 수동 처리·자동 처리한다. 늦게 도착한 공고도 다시 처리할 수 있고 저장은 멱등하다. */
    public void run(LocalDate date,String task,boolean manual) {
        if(!enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Recruitment disabled");
        if(!TASKS.contains(task) || date.isAfter(LocalDate.now(SEOUL))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid job");
        if(task.equals("REPORT")) inbox.purgeExpired();
        inbox.exclusive(()->{
            store.jdbc.sql("""
                INSERT INTO lab.recruitment_agent_job(id,work_date,task,state,attempts,started_at)
                VALUES (:id,:date,:task,'WORKING',1,now()) ON CONFLICT(work_date,task) DO UPDATE SET
                state='WORKING',attempts=recruitment_agent_job.attempts+1,started_at=now(),finished_at=NULL,error=NULL,updated_at=now()
                """).param("id",UUID.randomUUID()).param("date",date).param("task",task).update();
            try {
                int count=switch(task) {
                    case "SEARCH" -> store.jdbc.sql("SELECT count(*) FROM lab.recruitment_intake WHERE work_date=:date").param("date",date).query(Integer.class).single();
                    case "CHECK" -> store.check();
                    case "REGISTER" -> {int registered=store.register();inbox.syncSnapshots();yield registered;}
                    case "REPORT" -> store.report(date);
                    default -> throw new IllegalArgumentException();
                };
                finish(date,task,"COMPLETED",count,null);
            } catch(Exception e) {finish(date,task,"FAILED",0,"JOB_FAILED_"+e.getClass().getSimpleName());throw e;}
            return null;
        });
    }
    /** 근거 보완을 정기 업무와 같은 락으로 직렬화하고 화면 스냅샷도 갱신한다. */
    public void updateEvidence(UUID id,tools.jackson.databind.JsonNode facts) {
        inbox.exclusive(()->{store.manual(id,facts);store.check();store.register();inbox.syncSnapshots();return null;});
    }
    private void finish(LocalDate date,String task,String state,int processed,String error) {
        store.jdbc.sql("UPDATE lab.recruitment_agent_job SET state=:state,processed=:processed,error=:error,finished_at=now(),updated_at=now() WHERE work_date=:date AND task=:task")
            .param("state",state).param("processed",processed).param("error",error).param("date",date).param("task",task).update();
    }
    /**
     * 채용 HTTP 요청이 게임 예약 작업을 지연시키지 않도록 전용 스케줄러를 제공한다.
     * @author seulgae
     * @version 1.0, 게임과 채용 스케줄러 분리
     * @see "None"
     */
    @Configuration
    public static class Scheduling {
        /** 기존 웹소켓 예약 작업의 기본 스케줄러를 별도로 유지한다. */
        @Bean(name="taskScheduler")
        ThreadPoolTaskScheduler taskScheduler() {
            var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("lab-scheduler-");return scheduler;
        }
        @Bean(name="recruitmentScheduler")
        ThreadPoolTaskScheduler recruitmentScheduler() {
            var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("recruitment-");return scheduler;
        }
    }
}
