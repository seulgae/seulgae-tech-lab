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
        for(String table:List.of("recruitment_evidence","recruitment_posting_source","recruitment_posting_history","recruitment_posting","recruitment_company","recruitment_collection","recruitment_agent_job","recruitment_daily_report"))
            store.jdbc.sql("DELETE FROM lab."+table).update();
    }
    @Test void pipelineIsIdempotentAndPreservesExpiredHistory() throws Exception {
        var search=mock(RecruitmentSearch.class);when(search.available()).thenReturn(true);when(search.inspect(any())).thenAnswer(call->call.getArgument(0));
        var candidate=RecruitmentRulesTest.item();
        when(search.search(any(),anyList())).thenReturn(List.of(candidate));
        var jobs=new RecruitmentJobs(ds,store,search,true);var date=LocalDate.now(RecruitmentJobs.SEOUL);
        assertEquals(409,assertThrows(ResponseStatusException.class,()->jobs.run(date,"REGISTER",true)).getStatusCode().value());
        jobs.run(date,"SEARCH",true);jobs.run(date,"CHECK",true);jobs.run(date,"REGISTER",true);
        assertEquals(409,assertThrows(ResponseStatusException.class,()->jobs.run(date,"SEARCH",true)).getStatusCode().value());
        store.collect(List.of(candidate));store.collect(List.of(candidate));store.check();store.register();
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_posting").query(Integer.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_posting_source").query(Integer.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_company").query(Integer.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_posting_history WHERE kind='NEW'").query(Integer.class).single());
        store.jdbc.sql("UPDATE lab.recruitment_posting SET deadline=now()-interval '1 minute'").update();
        store.report(date);store.report(date);
        assertEquals("EXPIRED",store.jdbc.sql("SELECT status FROM lab.recruitment_posting").query(String.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_posting_history WHERE kind='EXPIRED'").query(Integer.class).single());
        assertEquals(1,store.jdbc.sql("SELECT count(*) FROM lab.recruitment_daily_report").query(Integer.class).single());
        assertNotNull(store.dashboard(date).get("postings"));
        try(var c=ds.getConnection();var s=c.createStatement()) {
            s.execute("SELECT pg_advisory_lock(1256381,12)");
            assertEquals(409,assertThrows(ResponseStatusException.class,()->jobs.run(date,"REPORT",true)).getStatusCode().value());
        }
    }
    @Test void missingKeyAndFailedPredecessorNeverProduceFakeSuccess() {
        var search=mock(RecruitmentSearch.class);when(search.available()).thenReturn(false);
        var jobs=new RecruitmentJobs(ds,store,search,true);var date=LocalDate.now(RecruitmentJobs.SEOUL);
        jobs.run(date,"SEARCH",true);
        assertEquals("UNAVAILABLE",store.jdbc.sql("SELECT state FROM lab.recruitment_agent_job").query(String.class).single());
        assertEquals(409,assertThrows(ResponseStatusException.class,()->jobs.run(date,"CHECK",true)).getStatusCode().value());
        when(search.available()).thenReturn(true);when(search.inspect(any())).thenAnswer(call->call.getArgument(0));when(search.search(any(),anyList())).thenThrow(new IllegalStateException("test"));
        jobs.run(date,"SEARCH",true);
        assertEquals("FAILED",store.jdbc.sql("SELECT state FROM lab.recruitment_agent_job").query(String.class).single());
        doReturn(List.of(RecruitmentRulesTest.item())).when(search).search(any(),anyList());
        // 프로세스 재시작을 새 실행 서비스 인스턴스로 재현한다. 이력은 DB에 유지된다.
        var restarted=new RecruitmentJobs(ds,store,search,true);restarted.run(date,"SEARCH",true);
        assertEquals("COMPLETED",store.jdbc.sql("SELECT state FROM lab.recruitment_agent_job").query(String.class).single());
    }
}
