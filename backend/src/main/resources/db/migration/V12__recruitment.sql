-- 기존 V11 앱이 무시하는 독립 채용 모듈. 기본 권한은 기존 migrator provisioning을 따른다.
CREATE TABLE lab.recruitment_policy (
 version integer PRIMARY KEY, rules jsonb NOT NULL, starts_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO lab.recruitment_policy VALUES (1,
 '{"minEmployees":100,"minRating":2.5,"companyType":"SME","excludedProbationMonths":6}',
 (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, now());
CREATE TABLE lab.recruitment_company (
 id uuid PRIMARY KEY, identity_key text NOT NULL UNIQUE, name text NOT NULL,
 facts jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lab.recruitment_collection (
 id uuid PRIMARY KEY, source text NOT NULL, external_id text NOT NULL, url text NOT NULL,
 payload jsonb NOT NULL, validation text NOT NULL DEFAULT 'REVIEW' CHECK(validation IN ('ELIGIBLE','REVIEW','REJECTED')),
 reasons jsonb NOT NULL DEFAULT '[]', policy_version integer NOT NULL REFERENCES lab.recruitment_policy(version),
 collected_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz,
 UNIQUE(source, external_id)
);
CREATE INDEX recruitment_collection_status_idx ON lab.recruitment_collection(validation, collected_at);
CREATE TABLE lab.recruitment_posting (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES lab.recruitment_company(id),
 identity_key text NOT NULL UNIQUE, title text NOT NULL, details jsonb NOT NULL,
 validation text NOT NULL CHECK(validation IN ('ELIGIBLE','REVIEW','REJECTED')),
 status text NOT NULL CHECK(status IN ('ACTIVE','EXPIRED')),
 deadline timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recruitment_posting_status_idx ON lab.recruitment_posting(status, validation, deadline);
CREATE TABLE lab.recruitment_posting_source (
 source text NOT NULL, external_id text NOT NULL, posting_id uuid NOT NULL REFERENCES lab.recruitment_posting(id),
 url text NOT NULL, last_checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source, external_id)
);
CREATE TABLE lab.recruitment_evidence (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES lab.recruitment_collection(id),
 field text NOT NULL, value jsonb NOT NULL, url text NOT NULL, quote text NOT NULL,
 checked_at timestamptz NOT NULL, method text NOT NULL CHECK(method IN ('WEB_SEARCH','MANUAL')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recruitment_evidence_collection_idx ON lab.recruitment_evidence(collection_id, field);
CREATE TABLE lab.recruitment_agent_job (
 id uuid PRIMARY KEY, work_date date NOT NULL, task text NOT NULL CHECK(task IN ('SEARCH','CHECK','REGISTER','REPORT')),
 state text NOT NULL CHECK(state IN ('WAITING','WORKING','COMPLETED','FAILED','UNAVAILABLE')),
 attempts integer NOT NULL DEFAULT 0, processed integer NOT NULL DEFAULT 0, error text,
 next_retry_at timestamptz, started_at timestamptz, finished_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(work_date, task)
);
CREATE INDEX recruitment_job_state_idx ON lab.recruitment_agent_job(state, work_date);
CREATE TABLE lab.recruitment_posting_history (
 id uuid PRIMARY KEY, posting_id uuid NOT NULL REFERENCES lab.recruitment_posting(id),
 kind text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recruitment_history_posting_idx ON lab.recruitment_posting_history(posting_id, created_at);
CREATE TABLE lab.recruitment_daily_report (
 work_date date PRIMARY KEY, summary jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
