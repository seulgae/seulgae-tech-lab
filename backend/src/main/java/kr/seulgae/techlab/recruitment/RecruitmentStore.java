package kr.seulgae.techlab.recruitment;

import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.*;
import tools.jackson.databind.json.JsonMapper;

/**
 * 채용 전용 테이블의 멱등 저장과 변경 이력·보고서를 관리한다.
 * @author seulgae
 * @version 1.0, 채용 JDBC 저장소
 * @see "None"
 */
@Repository
public class RecruitmentStore {
    final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final JsonMapper json=JsonMapper.builder().build();
    public RecruitmentStore(JdbcClient jdbc, PlatformTransactionManager manager) {this.jdbc=jdbc;this.tx=new TransactionTemplate(manager);}
    String encode(Object value) {return json.writeValueAsString(value);}
    JsonNode node(String text) {return json.readTree(text);}
    /** 수집 결과와 각 근거를 원본 ID 기준으로 갱신한다. 기존 검증은 무효화한다. */
    public int collect(List<JsonNode> items) {
        return tx.execute(status -> {
            for(var p:items) {
                UUID id=jdbc.sql("""
                    INSERT INTO lab.recruitment_collection(id,source,external_id,url,payload,policy_version)
                    VALUES (:id,:source,:external,:url,CAST(:payload AS jsonb),1)
                    ON CONFLICT(source,external_id) DO UPDATE SET url=excluded.url,payload=excluded.payload || jsonb_build_object('facts',COALESCE(recruitment_collection.payload->'facts','{}'::jsonb) || (excluded.payload->'facts')),
                    validation='REVIEW',reasons='[]',checked_at=NULL,collected_at=now()
                    RETURNING id
                    """).param("id",UUID.randomUUID()).param("source",p.path("source").asText()).param("external",p.path("externalId").asText())
                    .param("url",p.path("url").asText()).param("payload",p.toString()).query(UUID.class).single();
                if(p.path("facts").size()>0) evidence(id,p,"WEB_SEARCH");
            }
            return items.size();
        });
    }
    private void evidence(UUID id,JsonNode p,String method) {
        jdbc.sql("DELETE FROM lab.recruitment_evidence WHERE collection_id=:id").param("id",id).update();
        for(String field:List.of("javaBackend","companyType","employees","rating","probationMonths","accepting","deadline")) {
            var fact=p.path("facts").path(field);
            if(!RecruitmentRules.evidence(fact,field,Instant.now())) continue;
            jdbc.sql("""
                INSERT INTO lab.recruitment_evidence(id,collection_id,field,value,url,quote,checked_at,method)
                VALUES (:id,:collection,:field,CAST(:value AS jsonb),:url,:quote,:checked,:method)
                """).param("id",UUID.randomUUID()).param("collection",id).param("field",field).param("value",fact.path("value").toString())
                .param("url",fact.path("url").asText()).param("quote",fact.path("quote").asText())
                .param("checked",OffsetDateTime.parse(fact.path("checkedAt").asText())).param("method",method).update();
        }
    }
    /** 관리자가 출처를 직접 확인한 사실을 보완하면 다음 검증에서 재평가한다. */
    public void manual(UUID id,JsonNode facts) {
        tx.executeWithoutResult(status -> {
            String raw=jdbc.sql("SELECT payload::text FROM lab.recruitment_collection WHERE id=:id FOR UPDATE").param("id",id).query(String.class).optional().orElseThrow();
            var p=(tools.jackson.databind.node.ObjectNode)node(raw);
            p.set("facts",facts);
            jdbc.sql("UPDATE lab.recruitment_collection SET payload=CAST(:p AS jsonb),checked_at=NULL,validation='REVIEW' WHERE id=:id")
                .param("p",p.toString()).param("id",id).update();
            evidence(id,p,"MANUAL");
        });
    }
    /** 모든 후보를 다시 검증해 근거 유효기간과 수동 보완 결과도 반영한다. */
    public int check() {
        return tx.execute(status -> {
            var rows=jdbc.sql("SELECT id,payload::text FROM lab.recruitment_collection ORDER BY collected_at").query((rs,n)->Map.entry(rs.getObject(1,UUID.class),rs.getString(2))).list();
            for(var row:rows) {
                var v=RecruitmentRules.validate(node(row.getValue()),Instant.now());
                jdbc.sql("UPDATE lab.recruitment_collection SET validation=:v,reasons=CAST(:r AS jsonb),checked_at=now() WHERE id=:id")
                    .param("v",v.get("state")).param("r",encode(v.get("reasons"))).param("id",row.getKey()).update();
            }
            return rows.size();
        });
    }
    /** 동일 회사명·공고명·출처 ID를 이용해 보수적으로 중복을 묶고 변경 시에만 이력을 남긴다. */
    public int register() {
        return tx.execute(status -> {
            var rows=jdbc.sql("SELECT id,payload::text,validation FROM lab.recruitment_collection WHERE checked_at IS NOT NULL ORDER BY collected_at")
                .query((rs,n)->List.of(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3))).list();
            for(var row:rows) {
                var p=node((String)row.get(1)); String company=p.path("company").asText().strip(),title=p.path("title").asText().strip();
                String companyKey=(p.path("companyConfirmed").asBoolean(true) ? company : p.path("source").asText()+":"+p.path("externalId").asText()).replaceAll("\\s+","").toLowerCase(Locale.ROOT);
                UUID cid=jdbc.sql("""
                    INSERT INTO lab.recruitment_company(id,identity_key,name,facts) VALUES (:id,:key,:name,CAST(:facts AS jsonb))
                    ON CONFLICT(identity_key) DO UPDATE SET facts=excluded.facts,updated_at=now() RETURNING id
                    """).param("id",UUID.randomUUID()).param("key",companyKey).param("name",company).param("facts",p.path("facts").toString()).query(UUID.class).single();
                // 이름 유사도만으로 다른 출처의 공고를 병합하지 않는다. 원본 연결이 우선이다.
                String identity=p.path("source").asText()+":"+p.path("externalId").asText();
                var existing=jdbc.sql("SELECT id,details::text,validation,status FROM lab.recruitment_posting WHERE identity_key=:key").param("key",identity)
                    .query((rs,n)->List.of(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getString(4))).optional();
                UUID pid=existing.map(e->(UUID)e.get(0)).orElseGet(UUID::randomUUID);
                Instant deadline=RecruitmentRules.deadline(p);
                String active=(deadline!=null && !deadline.isAfter(Instant.now())) ||
                    (RecruitmentRules.evidence(p.path("facts").path("accepting"),"accepting",Instant.now()) && p.path("facts").path("accepting").path("value").isBoolean() && !p.path("facts").path("accepting").path("value").asBoolean()) ? "EXPIRED":"ACTIVE";
                boolean previousExpired=existing.isPresent() && existing.get().get(3).equals("EXPIRED");
                var accepting=p.path("facts").path("accepting");
                boolean confirmedOpen=RecruitmentRules.evidence(accepting,"accepting",Instant.now()) && accepting.path("value").isBoolean() && accepting.path("value").asBoolean();
                if(previousExpired && active.equals("ACTIVE") && !confirmedOpen && deadline==null) active="EXPIRED";
                jdbc.sql("""
                    INSERT INTO lab.recruitment_posting(id,company_id,identity_key,title,details,validation,status,deadline)
                    VALUES (:id,:company,:key,:title,CAST(:p AS jsonb),:v,:state,:deadline)
                    ON CONFLICT(identity_key) DO UPDATE SET details=excluded.details,validation=excluded.validation,
                    status=excluded.status,deadline=excluded.deadline,title=excluded.title,company_id=excluded.company_id,updated_at=now()
                    """).param("id",pid).param("company",cid).param("key",identity).param("title",title).param("p",p.toString())
                    .param("v",row.get(2)).param("state",active).param("deadline",deadline==null?null:deadline.atOffset(ZoneOffset.UTC)).update();
                jdbc.sql("""
                    INSERT INTO lab.recruitment_posting_source(source,external_id,posting_id,url,last_checked_at)
                    VALUES (:source,:external,:id,:url,now()) ON CONFLICT(source,external_id) DO UPDATE SET url=excluded.url,last_checked_at=now()
                    """).param("source",p.path("source").asText()).param("external",p.path("externalId").asText()).param("id",pid).param("url",p.path("url").asText()).update();
                if(existing.isEmpty() || !node((String)existing.get().get(1)).equals(p) || !existing.get().get(2).equals(row.get(2)))
                    history(pid,existing.isEmpty()?"NEW":"UPDATED",p);
                if(active.equals("EXPIRED") && !previousExpired) history(pid,"EXPIRED",p);
                if(active.equals("ACTIVE") && previousExpired) history(pid,"REOPENED",p);
            }
            return rows.size();
        });
    }
    private void history(UUID id,String kind,JsonNode p) {
        jdbc.sql("INSERT INTO lab.recruitment_posting_history(id,posting_id,kind,snapshot) VALUES (:id,:posting,:kind,CAST(:p AS jsonb))")
            .param("id",UUID.randomUUID()).param("posting",id).param("kind",kind).param("p",p.toString()).update();
    }
    /** 마감일이 확인된 공고만 종료하고 날짜별 보고서를 멱등 갱신한다. */
    public int report(LocalDate date) {
        return tx.execute(status -> {
            var expired=jdbc.sql("UPDATE lab.recruitment_posting SET status='EXPIRED',updated_at=now() WHERE status='ACTIVE' AND deadline<=now() RETURNING id,details::text")
                .query((rs,n)->Map.entry(rs.getObject(1,UUID.class),node(rs.getString(2)))).list();
            expired.forEach(e->history(e.getKey(),"EXPIRED",e.getValue()));
            jdbc.sql("""
                INSERT INTO lab.recruitment_daily_report(work_date,summary) VALUES (:date,CAST(:summary AS jsonb))
                ON CONFLICT(work_date) DO UPDATE SET summary=excluded.summary,updated_at=now()
                """).param("date",date).param("summary",encode(stats(date))).update();
            return expired.size();
        });
    }
    public List<String> activeUrls() {
        return jdbc.sql("SELECT s.url FROM lab.recruitment_posting_source s JOIN lab.recruitment_posting p ON p.id=s.posting_id WHERE p.status='ACTIVE' ORDER BY s.last_checked_at LIMIT 10").query(String.class).list();
    }
    private Map<String,Object> stats(LocalDate date) {
        return jdbc.sql("""
            SELECT (SELECT count(*) FROM lab.recruitment_collection) AS collected,
            count(*) FILTER(WHERE status='ACTIVE' AND validation='ELIGIBLE') AS active,
            count(*) FILTER(WHERE validation='ELIGIBLE') AS eligible,
            count(*) FILTER(WHERE validation='REVIEW') AS review,
            (SELECT count(*) FROM lab.recruitment_posting_history WHERE kind='NEW' AND (created_at AT TIME ZONE 'Asia/Seoul')::date=:date) AS new_today,
            (SELECT count(*) FROM lab.recruitment_posting_history WHERE kind='EXPIRED' AND (created_at AT TIME ZONE 'Asia/Seoul')::date=:date) AS expired_today
            FROM lab.recruitment_posting
            """).param("date",date).query().singleRow();
    }
    /** 관리자 전용 대시보드. 페이지 크기를 제한하고 JSON 열은 문자열 대신 JSON으로 반환한다. */
    public Map<String,Object> dashboard(LocalDate date) {
        return Map.of("stats",stats(date),"jobs",jdbc.sql("SELECT id,work_date,task,state,attempts,processed,error,started_at,finished_at FROM lab.recruitment_agent_job ORDER BY work_date DESC,created_at LIMIT 40").query().listOfRows(),
            "postings",jdbc.sql("SELECT row_to_json(p)::text FROM (SELECT c.id,c.payload AS details,c.validation,c.reasons,p.status FROM lab.recruitment_collection c LEFT JOIN lab.recruitment_posting_source s ON s.source=c.source AND s.external_id=c.external_id LEFT JOIN lab.recruitment_posting p ON p.id=s.posting_id ORDER BY c.collected_at DESC LIMIT 100) p")
                .query((rs,n)->node(rs.getString(1))).list(),
            "reviews",jdbc.sql("SELECT row_to_json(r)::text FROM (SELECT * FROM lab.recruitment_review ORDER BY updated_at DESC LIMIT 200) r").query((rs,n)->node(rs.getString(1))).list(),
            "reports",jdbc.sql("SELECT row_to_json(r)::text FROM (SELECT * FROM lab.recruitment_daily_report ORDER BY work_date DESC LIMIT 7) r").query((rs,n)->node(rs.getString(1))).list());
    }
}
