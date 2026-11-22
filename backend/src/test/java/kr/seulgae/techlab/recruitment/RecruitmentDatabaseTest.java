package kr.seulgae.techlab.recruitment;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * CI 일회용 PostgreSQL에서 멱등 저장·업무 순서·세션 락·마감·보고서를 검증한다.
 * @author seulgae
 * @version 1.0, 실제 DB 채용 파이프라인 검증
 * @see "None"
 */
@EnabledIfEnvironmentVariable(named="RECRUITMENT_TEST_DB",matches="true")
class RecruitmentDatabaseTest {
    private DriverManagerDataSource ds;
    private RecruitmentStore store;
    @BeforeEach void prepare() {
        // 테스트용으로 고정된 일회용 DB만 사용한다. 개발·운영 인증정보는 읽지 않는다.
        ds=new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:5432/research_ci?currentSchema=lab","test_app","ci-app-only");
        store=new RecruitmentStore(JdbcClient.create(ds),new DataSourceTransactionManager(ds));
        clean();
    }
    @AfterEach void clean() {
        if(store==null) return;
        for(String table:List.of("recruitment_review","recruitment_intake","recruitment_evidence","recruitment_posting_source","recruitment_posting_history","recruitment_posting","recruitment_company","recruitment_collection","recruitment_agent_job","recruitment_daily_report"))
            store.jdbc.sql("DELETE FROM lab."+table).update();
    }
    private RecruitmentInbox inbox() {return new RecruitmentInbox(store,ds,new DataSourceTransactionManager(ds));}
    private tools.jackson.databind.node.ObjectNode candidate(int n) {
        var p=RecruitmentRulesTest.item();p.put("company","테스트기업"+n);p.put("externalId",String.valueOf(n));
        p.put("url","https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx="+n);return p;
    }
    @Test void limitsAndCompanyDuplicatesAreAtomic() {
        var inbox=inbox();var json=tools.jackson.databind.json.JsonMapper.builder().build();
        inbox.ingest(json.valueToTree(List.of(candidate(1))));
        assertThrows(ResponseStatusException.class,()->inbox.ingest(json.valueToTree(List.of(candidate(2),candidate(1)))));
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_intake").query(Integer.class).single(),"중복 배치의 앞 공고도 롤백한다");
        var remaining=new ArrayList<Object>();for(int i=2;i<=10;i++) remaining.add(candidate(i));inbox.ingest(json.valueToTree(remaining));
        assertEquals(10,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_collection").query(Integer.class).single());
        assertEquals(409,assertThrows(ResponseStatusException.class,()->inbox.ingest(json.valueToTree(List.of(candidate(11))))).getStatusCode().value());
    }
    @Test void reviewDecisionsSurvivePhysicalExpiryDeletion() {
        var inbox=inbox();var json=tools.jackson.databind.json.JsonMapper.builder().build();
        inbox.ingest(json.valueToTree(List.of(candidate(20))));
        var jobs=new RecruitmentJobs(store,inbox,true);jobs.run(LocalDate.now(RecruitmentJobs.SEOUL),"CHECK",true);jobs.run(LocalDate.now(RecruitmentJobs.SEOUL),"REGISTER",true);
        UUID id=store.jdbc.sql("SELECT id FROM lab.recruitment_review").query(UUID.class).single();UUID actor=UUID.randomUUID();
        assertThrows(ResponseStatusException.class,()->inbox.transition(id,"APPLIED",actor));
        inbox.transition(id,"READ",actor);inbox.transition(id,"CONFIRMED",actor);inbox.transition(id,"HOLD",actor);inbox.transition(id,"APPLIED",actor);
        store.jdbc.sql("UPDATE lab.recruitment_posting SET deadline=now()-interval '1 minute'").update();
        assertEquals(1,inbox.purgeExpired());assertEquals(0,inbox.purgeExpired());
        store.report(LocalDate.now(RecruitmentJobs.SEOUL));
        assertEquals(1,store.jdbc.sql("SELECT (summary->>'expired_today')::integer FROM lab.recruitment_daily_report").query(Integer.class).single(),"삭제 후에도 마감 통계는 남는다");
        assertEquals(0,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_posting").query(Integer.class).single());
        assertEquals(0,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_collection").query(Integer.class).single());
        assertEquals("APPLIED",store.jdbc.sql("SELECT state FROM lab.recruitment_review WHERE collection_id IS NULL").query(String.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_intake").query(Integer.class).single());
        assertThrows(ResponseStatusException.class,()->inbox.ingest(json.valueToTree(List.of(candidate(20)))));
        assertNotNull(store.dashboard(LocalDate.now(RecruitmentJobs.SEOUL)).get("reviews"));
    }
    @Test void sessionLockProtectsMultipleInstances() throws Exception {
        var inbox=inbox();var json=tools.jackson.databind.json.JsonMapper.builder().build();
        try(var connection=ds.getConnection();var statement=connection.createStatement()) {
            statement.execute("SELECT pg_advisory_lock(1256381,12)");
            assertEquals(409,assertThrows(ResponseStatusException.class,()->inbox.ingest(json.valueToTree(List.of(candidate(30))))).getStatusCode().value());
        }
        inbox.ingest(json.valueToTree(List.of(candidate(30))));
        new RecruitmentJobs(store,inbox(),true).tick();
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_posting").query(Integer.class).single(),"재시작 후 수신함 처리, 검색 키 불필요");
    }
    @Test void oldCandidatesJoinTheReviewWorkflowWithoutNewImport() {
        store.collect(List.of(candidate(40)));
        var jobs=new RecruitmentJobs(store,inbox(),true);jobs.tick();jobs.tick();
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_review").query(Integer.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_intake").query(Integer.class).single());
    }

}
