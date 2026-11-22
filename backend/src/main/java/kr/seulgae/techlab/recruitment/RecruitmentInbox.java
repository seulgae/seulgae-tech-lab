package kr.seulgae.techlab.recruitment;

import java.sql.Connection;
import java.time.*;
import java.text.Normalizer;
import java.util.*;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 채팅에서 정형화한 공고를 하루 10건까지 접수하고 검토·지원·보류 및 마감 삭제를 관리한다.
 * @author seulgae
 * @version 1.0, 외부 정형 공고 접수와 지원 흐름
 * @see "None"
 */
@Service
public class RecruitmentInbox {
    private final RecruitmentStore store;
    private final DataSource ds;
    private final TransactionTemplate tx;
    public RecruitmentInbox(RecruitmentStore store,DataSource ds,PlatformTransactionManager manager) {
        this.store=store;this.ds=ds;this.tx=new TransactionTemplate(manager);
    }
    /** 모든 입력을 먼저 검증하며 한 배치라도 한도·중복에 걸리면 전부 롤백한다. */
    public Map<String,Object> ingest(JsonNode payload) {
        if(!payload.isArray() || payload.isEmpty() || payload.size()>10 || payload.toString().length()>150000) throw bad("1~10개 공고 배열이 필요합니다");
        var items=new ArrayList<JsonNode>();var companies=new HashSet<String>();var sources=new HashSet<String>();
        for(var input:payload) {
            var item=validate(input);String key=companyKey(item.path("company").asText());
            if(!companies.add(key) || !sources.add(item.path("source").asText()+":"+item.path("externalId").asText())) throw conflict("배치 안 기업 또는 공고가 중복입니다");
            items.add(item);
        }
        return exclusive(()->tx.execute(status->{
            LocalDate date=LocalDate.now(RecruitmentJobs.SEOUL);
            int count=store.jdbc.sql("SELECT count(*) FROM lab.recruitment_intake WHERE work_date=:date").param("date",date).query(Integer.class).single();
            // 원장을 지우지 않으므로 마감 공고가 삭제되어도 한도가 다시 생기지 않는다.
            if(count+items.size()>10) throw conflict("한국 날짜 기준 하루 최대 10건입니다");
            var ids=new ArrayList<UUID>();
            for(var item:items) {
                String key=companyKey(item.path("company").asText());
                boolean duplicate=store.jdbc.sql("SELECT EXISTS(SELECT 1 FROM lab.recruitment_intake WHERE company_key=:key OR (source=:source AND external_id=:external))")
                    .param("key",key).param("source",item.path("source").asText()).param("external",item.path("externalId").asText()).query(Boolean.class).single();
                if(duplicate) throw conflict("기존 등록 기업 또는 공고입니다: "+item.path("company").asText());
                // 기존 V12 데이터도 중복 검사에 포함한다.
                var existing=store.jdbc.sql("SELECT payload::text FROM lab.recruitment_collection").query(String.class).list();
                if(existing.stream().map(store::node).anyMatch(p->companyKey(p.path("company").asText()).equals(key)
                    || (p.path("source").asText().equals(item.path("source").asText()) && p.path("externalId").asText().equals(item.path("externalId").asText())))) throw conflict("기존 공고와 기업이 겹칩니다");
                UUID id=UUID.randomUUID();
                store.jdbc.sql("INSERT INTO lab.recruitment_intake(id,company_key,source,external_id,work_date) VALUES (:id,:key,:source,:external,:date)")
                    .param("id",id).param("key",key).param("source",item.path("source").asText()).param("external",item.path("externalId").asText()).param("date",date).update();
                store.collect(List.of(item));
                UUID collection=store.jdbc.sql("SELECT id FROM lab.recruitment_collection WHERE source=:source AND external_id=:external")
                    .param("source",item.path("source").asText()).param("external",item.path("externalId").asText()).query(UUID.class).single();
                store.jdbc.sql("INSERT INTO lab.recruitment_review(id,collection_id,company,title,snapshot) VALUES (:id,:collection,:company,:title,CAST(:snapshot AS jsonb))")
                    .param("id",id).param("collection",collection).param("company",item.path("company").asText()).param("title",item.path("title").asText()).param("snapshot",item.toString()).update();
                ids.add(id);
            }
            return Map.of("registered",ids.size(),"ids",ids,"workDate",date,"remaining",10-count-ids.size());
        }));
    }
    /** 명시된 원문 정보만 사용한다. 등록 시 만료 공고와 잘못된 근거를 거부한다. */
    static ObjectNode validate(JsonNode input) {
        if(!input.isObject()) throw bad("잘못된 공고 형식");
        var p=(ObjectNode)input.deepCopy();
        for(String f:List.of("company","title","externalId","url","source")) if(!p.path(f).isTextual() || p.path(f).asText().isBlank()) throw bad("필수 항목: "+f);
        if(p.path("company").asText().length()>150 || p.path("title").asText().length()>300 || p.path("externalId").asText().length()>100 || p.toString().length()>15000) throw bad("공고 길이 제한 초과");
        if(companyKey(p.path("company").asText()).isBlank() || p.path("company").asText().equals("미확인")) throw bad("확인된 기업명이 필요합니다");
        if(!Set.of("SARAMIN","JOBKOREA").contains(p.path("source").asText()) || !RecruitmentRules.safeUrl(p.path("url").asText())) throw bad("지원하지 않는 출처");
        String host=java.net.URI.create(p.path("url").asText()).getHost();
        String domain=p.path("source").asText().equals("SARAMIN")?"saramin.co.kr":"jobkorea.co.kr";
        if(!host.equals(domain) && !host.endsWith("."+domain)) throw bad("출처와 원본 주소가 다릅니다");
        for(String f:List.of("summary","content","stack","career","region"))
            if(p.hasNonNull(f) && !p.path(f).isTextual()) throw bad("문자열 항목: "+f);
        var sourceId=java.util.regex.Pattern.compile(domain.equals("saramin.co.kr")?"[?&]rec_idx=(\\d+)":"(?i)/Recruit/GI_Read/(\\d+)").matcher(p.path("url").asText());
        if(!sourceId.find() || !sourceId.group(1).equals(p.path("externalId").asText())) throw bad("원본 주소의 공고 ID와 externalId가 다릅니다");
        if(!p.path("facts").isObject()) throw bad("facts 객체가 필요합니다. 미확인 값은 생략하세요");
        for(String f:List.of("javaBackend","companyType","employees","rating","probationMonths","accepting","deadline")) {
            var fact=p.path("facts").path(f);
            if(!fact.isMissingNode() && !fact.isNull() && !RecruitmentRules.evidence(fact,f,Instant.now())) throw bad("근거가 잘못된 항목: "+f);
        }
        var deadline=RecruitmentRules.deadline(p);
        if(deadline!=null && !deadline.isAfter(Instant.now())) throw bad("이미 마감된 공고입니다");
        if(p.path("facts").hasNonNull("deadline") && deadline==null) throw bad("마감일 형식 오류");
        p.put("company",p.path("company").asText().strip());p.put("companyConfirmed",true);p.put("intakeMethod","CHAT");
        return p;
    }
    /** 공백·전각·법인 표기 차이로 같은 기업이 다시 등록되지 않도록 정규화한다. */
    public static String companyKey(String name) {
        return Normalizer.normalize(name,Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replace("주식회사","").replace("(주)","").replace("㈜","").replaceAll("[\\s\\p{Punct}]","");
    }
    /** 사용자 확인을 거친 후에만 지원·보류할 수 있다. 외부 입사지원을 제출하는 API가 아니다. */
    public void transition(UUID id,String target,UUID actor) {
        if(target==null) throw bad("변경 상태가 필요합니다");
        exclusive(()->tx.execute(status->{
            var row=store.jdbc.sql("SELECT state,collection_id FROM lab.recruitment_review WHERE id=:id FOR UPDATE").param("id",id)
                .query((rs,n)->Map.entry(rs.getString(1),Optional.ofNullable(rs.getObject(2,UUID.class)))).optional().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"공고가 없습니다"));
            String from=row.getKey();
            if(from.equals(target)) return null;
            boolean allowed=switch(from) {case "NEW" -> target.equals("READ");case "READ" -> target.equals("CONFIRMED");case "CONFIRMED" -> Set.of("APPLIED","HOLD").contains(target);case "HOLD" -> target.equals("APPLIED");default -> false;};
            if(!allowed || row.getValue().isEmpty()) throw conflict("읽음 → 확인 → 지원/보류 순서로 처리하세요");
            String snapshot=store.jdbc.sql("SELECT payload::text FROM lab.recruitment_collection WHERE id=:id").param("id",row.getValue().get()).query(String.class).single();
            var deadline=RecruitmentRules.deadline(store.node(snapshot));
            if(deadline!=null && !deadline.isAfter(Instant.now())) throw conflict("이미 마감된 공고입니다");
            var event=List.of(Map.of("from",from,"to",target,"at",Instant.now().toString(),"actor",actor.toString()));
            store.jdbc.sql("UPDATE lab.recruitment_review SET state=:state,snapshot=CAST(:snapshot AS jsonb),events=events || CAST(:event AS jsonb),updated_at=now() WHERE id=:id")
                .param("state",target).param("snapshot",snapshot).param("event",store.encode(event)).param("id",id).update();
            return null;
        }));
    }
    /** 확인된 마감 공고 원문·근거·변경 이력을 삭제하고 지원·보류 스냅샷과 접수 원장은 보존한다. */
    public int purgeExpired() {
        return exclusive(()->tx.execute(status->{
            var ids=store.jdbc.sql("SELECT id,payload::text FROM lab.recruitment_collection")
                .query((rs,n)->Map.entry(rs.getObject(1,UUID.class),rs.getString(2))).list().stream()
                .filter(e->{var d=RecruitmentRules.deadline(store.node(e.getValue()));return d!=null && !d.isAfter(Instant.now());}).map(Map.Entry::getKey).toList();
            var postings=store.jdbc.sql("SELECT id FROM lab.recruitment_posting WHERE deadline<=now()").query(UUID.class).list();
            var all=new HashSet<>(postings);
            for(UUID cid:ids) all.addAll(store.jdbc.sql("SELECT p.id FROM lab.recruitment_posting p JOIN lab.recruitment_posting_source s ON s.posting_id=p.id JOIN lab.recruitment_collection c ON c.source=s.source AND c.external_id=s.external_id WHERE c.id=:id").param("id",cid).query(UUID.class).list());
            var deletedCollections=new HashSet<UUID>();
            for(UUID pid:all) {
                // 기존 V12 데이터도 후보 원문까지 함께 삭제한다.
                var related=store.jdbc.sql("SELECT c.id FROM lab.recruitment_collection c JOIN lab.recruitment_posting_source s ON c.source=s.source AND c.external_id=s.external_id WHERE s.posting_id=:id").param("id",pid).query(UUID.class).list();
                deletedCollections.addAll(related);
                for(UUID cid:related) deleteCollection(cid);
                store.jdbc.sql("DELETE FROM lab.recruitment_posting_history WHERE posting_id=:id").param("id",pid).update();
                store.jdbc.sql("DELETE FROM lab.recruitment_posting_source WHERE posting_id=:id").param("id",pid).update();
                store.jdbc.sql("DELETE FROM lab.recruitment_posting WHERE id=:id").param("id",pid).update();
            }
            for(UUID id:ids) deleteCollection(id);
            store.jdbc.sql("DELETE FROM lab.recruitment_company WHERE id NOT IN (SELECT company_id FROM lab.recruitment_posting)").update();
            int deleted=all.size()+ (int)ids.stream().filter(id->!deletedCollections.contains(id)).count();
            if(deleted>0) store.jdbc.sql("""
                INSERT INTO lab.recruitment_daily_report(work_date,summary) VALUES (:date,jsonb_build_object('expired_today',CAST(:count AS integer)))
                ON CONFLICT(work_date) DO UPDATE SET summary=recruitment_daily_report.summary ||
                jsonb_build_object('expired_today',COALESCE((recruitment_daily_report.summary->>'expired_today')::integer,0)+CAST(:count AS integer)),updated_at=now()
                """).param("date",LocalDate.now(RecruitmentJobs.SEOUL)).param("count",deleted).update();
            return deleted;
        }));
    }
    private void deleteCollection(UUID id) {
        // V12에서 접수한 기업도 마감 삭제 후 중복 검사 원장에 남긴다.
        var original=store.jdbc.sql("SELECT payload::text,(collected_at AT TIME ZONE 'Asia/Seoul')::date FROM lab.recruitment_collection WHERE id=:id")
            .param("id",id).query((rs,n)->Map.entry(store.node(rs.getString(1)),rs.getObject(2,LocalDate.class))).optional();
        original.ifPresent(row->{
            var p=row.getKey();String key=companyKey(p.path("company").asText());
            if(!key.isBlank() && !key.equals("미확인")) store.jdbc.sql("""
                INSERT INTO lab.recruitment_intake(id,company_key,source,external_id,work_date) VALUES (:id,:key,:source,:external,:date)
                ON CONFLICT DO NOTHING
                """).param("id",UUID.randomUUID()).param("key",key).param("source",p.path("source").asText()).param("external",p.path("externalId").asText()).param("date",row.getValue()).update();
        });
        store.jdbc.sql("DELETE FROM lab.recruitment_review WHERE collection_id=:id AND state NOT IN ('APPLIED','HOLD')").param("id",id).update();
        store.jdbc.sql("DELETE FROM lab.recruitment_evidence WHERE collection_id=:id").param("id",id).update();
        store.jdbc.sql("DELETE FROM lab.recruitment_collection WHERE id=:id").param("id",id).update();
    }
    /** 최신 정제 결과를 화면에 반영하되 이미 결정한 지원·보류 스냅샷은 변경하지 않는다. */
    public void syncSnapshots() {
        store.jdbc.sql("""
            UPDATE lab.recruitment_review r SET snapshot=c.payload
            FROM lab.recruitment_collection c WHERE c.id=r.collection_id AND r.state NOT IN ('APPLIED','HOLD')
            """).update();
    }
    /** 기존 V12 후보도 기업명이 있으면 검토 흐름에 연결한다. 원래 접수 날짜를 유지한다. */
    public void adoptLegacy() {
        exclusive(()->tx.execute(status->{
            var rows=store.jdbc.sql("""
                SELECT c.id,c.payload::text,(c.collected_at AT TIME ZONE 'Asia/Seoul')::date
                FROM lab.recruitment_collection c
                WHERE NOT EXISTS(SELECT 1 FROM lab.recruitment_intake i WHERE i.source=c.source AND i.external_id=c.external_id)
                ORDER BY c.collected_at
                """).query((rs,n)->List.of(rs.getObject(1,UUID.class),store.node(rs.getString(2)),rs.getObject(3,LocalDate.class))).list();
            for(var row:rows) {
                var p=(JsonNode)row.get(1);String company=p.path("company").asText(),key=companyKey(company);
                if(key.isBlank() || company.equals("미확인")) continue;
                var id=store.jdbc.sql("""
                    INSERT INTO lab.recruitment_intake(id,company_key,source,external_id,work_date) VALUES (:id,:key,:source,:external,:date)
                    ON CONFLICT DO NOTHING RETURNING id
                    """).param("id",UUID.randomUUID()).param("key",key).param("source",p.path("source").asText()).param("external",p.path("externalId").asText()).param("date",row.get(2)).query(UUID.class).optional();
                if(id.isPresent()) store.jdbc.sql("INSERT INTO lab.recruitment_review(id,collection_id,company,title,snapshot) VALUES (:id,:collection,:company,:title,CAST(:p AS jsonb))")
                    .param("id",id.get()).param("collection",row.get(0)).param("company",company).param("title",p.path("title").asText()).param("p",p.toString()).update();
            }
            return null;
        }));
    }
    /** 모든 쓰기 경로에서 기존 업무와 같은 DB 락을 사용한다. */
    public <T> T exclusive(Supplier<T> action) {
        try(Connection c=ds.getConnection()) {
            try(var s=c.createStatement();var r=s.executeQuery("SELECT pg_try_advisory_lock(1256381,12)")){r.next();if(!r.getBoolean(1)) throw conflict("다른 채용 업무가 처리 중입니다");}
            try{return action.get();}finally{try(var s=c.createStatement()){s.execute("SELECT pg_advisory_unlock(1256381,12)");}}
        } catch(java.sql.SQLException e) {throw new IllegalStateException("RECRUITMENT_LOCK_FAILED");}
    }
    static ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    static ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
}
