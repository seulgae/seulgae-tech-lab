/*
 * 채용 공고 수집·검토 기능 삭제(축소 단계).
 * 이 릴리스(15..16)의 앱은 이미 채용 테이블을 쓰지 않는다. V12·V13에서 만든 11개 테이블을 외래 키 순서대로(자식 → 부모) 지운다.
 * migrate-prod.py가 적용 전에 pg_dump 백업을 뜬다. 지운 행은 백업에서만 되살릴 수 있다.
 */
DROP TABLE lab.recruitment_review;
DROP TABLE lab.recruitment_intake;
DROP TABLE lab.recruitment_posting_history;
DROP TABLE lab.recruitment_posting_source;
DROP TABLE lab.recruitment_evidence;
DROP TABLE lab.recruitment_posting;
DROP TABLE lab.recruitment_collection;
DROP TABLE lab.recruitment_company;
DROP TABLE lab.recruitment_policy;
DROP TABLE lab.recruitment_agent_job;
DROP TABLE lab.recruitment_daily_report;
