-- 회원 등급(1 일반 사용자, 2 운영자, 3 관리자). 관리자(3)는 관리자실(운영 DB 쿼리 콘솔)에 들어갈 수 있다.
ALTER TABLE lab.members ADD COLUMN level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3);

-- 등급 신청(개발 연구실의 작은 컴퓨터). 신청 상태는 공통코드로 관리하고, 회원마다 대기 중인 신청은 하나만 둔다.
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('REQUEST_STATUS', 'PENDING', '검토 중', 1),
    ('REQUEST_STATUS', 'APPROVED', '승인', 2),
    ('REQUEST_STATUS', 'REJECTED', '반려', 3);

CREATE TABLE lab.level_requests (
    id uuid PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES lab.members (id) ON DELETE CASCADE,
    requested_level smallint NOT NULL CHECK (requested_level BETWEEN 2 AND 3),
    reason varchar(200) NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 200),
    status_group varchar(30) NOT NULL DEFAULT 'REQUEST_STATUS' CHECK (status_group = 'REQUEST_STATUS'),
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at timestamptz,
    decided_by uuid REFERENCES lab.members (id) ON DELETE SET NULL,
    FOREIGN KEY (status_group, status) REFERENCES lab.common_codes (code_group, code)
);
CREATE UNIQUE INDEX level_requests_one_pending_idx ON lab.level_requests (member_id) WHERE status = 'PENDING';
CREATE INDEX level_requests_status_created_idx ON lab.level_requests (status, created_at DESC);
