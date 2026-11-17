-- 공통코드: 코드 그룹별 코드와 표시 이름. 업무 게시판의 카테고리·진행 상태를 여기에 등록한다.
CREATE TABLE lab.common_codes (
    code_group varchar(30) NOT NULL,
    code varchar(20) NOT NULL CHECK (code ~ '^[A-Z_]{1,20}$'),
    name varchar(30) NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (code_group, code)
);

INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('WORK_CATEGORY', 'QA', 'QA', 1),
    ('WORK_CATEGORY', 'MAINTENANCE', '유지보수', 2),
    ('WORK_CATEGORY', 'OPERATION', '운영업무', 3),
    ('WORK_STATUS', 'REGISTERED', '등록', 1),
    ('WORK_STATUS', 'IN_PROGRESS', '조치 중', 2),
    ('WORK_STATUS', 'RESOLVED', '조치 완료', 3),
    ('WORK_STATUS', 'APPROVED', '최종 승인', 4),
    ('WORK_STATUS', 'REJECTED', '반려', 5);

-- 업무 기록(사무실 게시판). 한 테이블에 QA 등록, 유지보수 조치, 운영 점검을 모두 남기고 category로 구분한다.
-- QA 글(parent_id 없음)이 하나의 티켓이고 진행 상태(status)를 가진다. 유지보수·운영 기록은 parent_id로 티켓에 연결된다.
CREATE TABLE lab.work_items (
    id uuid PRIMARY KEY,
    parent_id uuid REFERENCES lab.work_items (id) ON DELETE CASCADE,
    category_group varchar(30) NOT NULL DEFAULT 'WORK_CATEGORY' CHECK (category_group = 'WORK_CATEGORY'),
    category varchar(20) NOT NULL,
    status_group varchar(30) NOT NULL DEFAULT 'WORK_STATUS' CHECK (status_group = 'WORK_STATUS'),
    status varchar(20) NOT NULL,
    title varchar(60) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
    content varchar(1000) NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
    guide varchar(1000),
    author_id uuid REFERENCES lab.members (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz,
    FOREIGN KEY (category_group, category) REFERENCES lab.common_codes (code_group, code),
    FOREIGN KEY (status_group, status) REFERENCES lab.common_codes (code_group, code),
    -- QA 티켓만 부모가 없고, 유지보수·운영 기록은 반드시 티켓에 연결된다.
    CHECK ((category = 'QA') = (parent_id IS NULL))
);

CREATE INDEX work_items_category_created_idx ON lab.work_items (category, created_at DESC, id DESC);
CREATE INDEX work_items_parent_idx ON lab.work_items (parent_id, created_at);
CREATE INDEX work_items_ticket_status_idx ON lab.work_items (status, created_at DESC) WHERE parent_id IS NULL;
