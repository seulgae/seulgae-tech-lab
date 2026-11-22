-- V12 앱은 이 테이블을 사용하지 않는다. 등록 원장으로 마감 삭제 후에도 일일 한도·중복 검사를 유지한다.
CREATE TABLE lab.recruitment_intake (
 id uuid PRIMARY KEY,
 company_key text NOT NULL UNIQUE,
 source text NOT NULL,
 external_id text NOT NULL,
 work_date date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source, external_id)
);
CREATE INDEX recruitment_intake_date_idx ON lab.recruitment_intake(work_date);

-- 지원·보류 내역은 공고 삭제와 독립된 스냅샷으로 보존한다.
CREATE TABLE lab.recruitment_review (
 id uuid PRIMARY KEY REFERENCES lab.recruitment_intake(id),
 collection_id uuid REFERENCES lab.recruitment_collection(id) ON DELETE SET NULL,
 company text NOT NULL,
 title text NOT NULL,
 snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'NEW' CHECK(state IN ('NEW','READ','CONFIRMED','APPLIED','HOLD')),
 events jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recruitment_review_state_idx ON lab.recruitment_review(state, updated_at);
