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
    static final int[] HOURS={9,13,15,17};
    private final DataSource dataSource;
    private final RecruitmentStore store;
    private final RecruitmentSearch search;
    final boolean enabled;
    public RecruitmentJobs(DataSource dataSource,RecruitmentStore store,RecruitmentSearch search,
        @Value("${lab.recruitment.enabled:false}") boolean enabled) {
        this.dataSource=dataSource;this.store=store;this.search=search;this.enabled=enabled;
    }
    /** 웹소켓 50ms 작업과 별도 스레드에서 하루 단위로 밀린 업무를 순서대로 보완한다. */
    @Scheduled(fixedDelay=60000,initialDelay=15000,scheduler="recruitmentScheduler")
    public void tick() {
        if(!enabled) return;
        try {
            var today=LocalDate.now(SEOUL);
            LocalDate start=store.jdbc.sql("SELECT starts_on FROM lab.recruitment_policy WHERE version=1").query(LocalDate.class).single();
            for(var date=start;!date.isAfter(today);date=date.plusDays(1)) {
                for(int i=0;i<TASKS.size();i++) {
                    if(date.equals(today) && ZonedDateTime.now(SEOUL).getHour()<HOURS[i]) return;
                    String task=TASKS.get(i);
                    var state=store.jdbc.sql("SELECT state FROM lab.recruitment_agent_job WHERE work_date=:date AND task=:task")
                        .param("date",date).param("task",task).query(String.class).optional();
                    if(state.orElse("").equals("COMPLETED")) continue;
                    run(date,task,false);
                    return; // 한 번에 한 업무만 처리해 API·DB 부하와 복구 폭주를 제한한다.
                }
            }
        } catch (Exception e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Recruitment scheduler could not advance ({})",e.getClass().getSimpleName()); }
    }
    /** 동일 날짜 업무의 성공은 반복하지 않는다. 실패는 15분 간격 최대 3회, 수동 실행으로 명시적으로 재시도한다. */
    public void run(LocalDate date,String task,boolean manual) {
        if(!enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Recruitment disabled");
        int index=TASKS.indexOf(task);
        if(index<0 || date.isAfter(LocalDate.now(SEOUL))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid job");
        try(Connection connection=dataSource.getConnection()) {
            boolean locked;
            try(var s=connection.createStatement();var r=s.executeQuery("SELECT pg_try_advisory_lock(1256381,12)")) {r.next();locked=r.getBoolean(1);}
            if(!locked) throw new ResponseStatusException(HttpStatus.CONFLICT,"Job already running");
            try {
                if(index>0) {
                    var previous=store.jdbc.sql("SELECT state FROM lab.recruitment_agent_job WHERE work_date=:date AND task=:task")
                        .param("date",date).param("task",TASKS.get(index-1)).query(String.class).optional().orElse("");
                    if(!previous.equals("COMPLETED")) throw new ResponseStatusException(HttpStatus.CONFLICT,"Previous job incomplete");
                }
                var current=store.jdbc.sql("SELECT state,attempts, next_retry_at FROM lab.recruitment_agent_job WHERE work_date=:date AND task=:task")
                    .param("date",date).param("task",task).query((rs,n)-> { var row=new HashMap<String,Object>();row.put("state",rs.getString(1));row.put("attempts",rs.getInt(2));row.put("next_retry_at",rs.getObject(3,OffsetDateTime.class));return row; }).optional();
                if(current.isPresent()) {
                    var j=current.get();
                    if(j.get("state").equals("COMPLETED")) { if(manual) throw new ResponseStatusException(HttpStatus.CONFLICT,"Job already completed"); return; }
                    if(!manual && ((Number)j.get("attempts")).intValue()>=3) return;
                    if(!manual && j.get("next_retry_at") instanceof OffsetDateTime t && t.toInstant().isAfter(Instant.now())) return;
                }
                store.jdbc.sql("""
                    INSERT INTO lab.recruitment_agent_job(id,work_date,task,state) VALUES (:id,:date,:task,'WAITING')
                    ON CONFLICT(work_date,task) DO NOTHING
                    """).param("id",UUID.randomUUID()).param("date",date).param("task",task).update();
                if((task.equals("SEARCH") || task.equals("REPORT")) && !search.available()) {
                    finish(date,task,"UNAVAILABLE",0,"SEARCH_KEY_NOT_CONFIGURED"); return;
                }
                store.jdbc.sql("UPDATE lab.recruitment_agent_job SET state='WORKING',attempts=attempts+1,started_at=now(),finished_at=NULL,error=NULL,updated_at=now() WHERE work_date=:date AND task=:task")
                    .param("date",date).param("task",task).update();
                try {
                    int count=switch(task) {
                        case "SEARCH" -> store.collect(search.search(LocalDate.now(SEOUL),List.of()));
                        case "CHECK" -> {store.inspect(search);yield store.check();}
                        case "REGISTER" -> store.register();
                        case "REPORT" -> {
                            var urls=store.activeUrls();
                            if(!urls.isEmpty()) {store.collect(search.search(LocalDate.now(SEOUL),urls));store.check();store.register();}
                            yield store.report(date);
                        }
                        default -> throw new IllegalArgumentException();
                    };
                    finish(date,task,"COMPLETED",count,null);
                } catch(Exception e) {finish(date,task,"FAILED",0,"JOB_FAILED_"+e.getClass().getSimpleName());}
            } finally {try(var s=connection.createStatement()){s.execute("SELECT pg_advisory_unlock(1256381,12)");}}
        } catch(java.sql.SQLException e) {throw new IllegalStateException("JOB_LOCK_ERROR");}
    }
    /** 수동 근거 보완도 정기 업무와 같은 DB 락으로 보호한다. */
    public void updateEvidence(UUID id,tools.jackson.databind.JsonNode facts) {
        try(Connection connection=dataSource.getConnection()) {
            try(var statement=connection.createStatement();var result=statement.executeQuery("SELECT pg_try_advisory_lock(1256381,12)")) {
                result.next();if(!result.getBoolean(1)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Job already running");
            }
            try {store.manual(id,facts);store.check();store.register();}
            finally {try(var statement=connection.createStatement()){statement.execute("SELECT pg_advisory_unlock(1256381,12)");}}
        } catch(java.sql.SQLException e) {throw new IllegalStateException("JOB_LOCK_ERROR");}
    }
    private void finish(LocalDate date,String task,String state,int processed,String error) {
        store.jdbc.sql("UPDATE lab.recruitment_agent_job SET state=:state,processed=:processed,error=:error,finished_at=now(),next_retry_at=now()+interval '15 minutes',updated_at=now() WHERE work_date=:date AND task=:task")
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
