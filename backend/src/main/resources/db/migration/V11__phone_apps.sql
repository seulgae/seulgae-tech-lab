-- 폰(I 키) 앱: 캘린더 할 일, SNS 글, 은행 송금.

-- 은행 송금: 보낸 쪽 TRANSFER_OUT(음수), 받은 쪽 TRANSFER_IN(양수) 두 행을 남기고, 서로를 상대 회원으로 적는다.
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'TRANSFER_OUT', '송금 보냄', 7),
    ('COIN_REASON', 'TRANSFER_IN', '송금 받음', 8);
ALTER TABLE lab.coin_events ADD COLUMN counterpart_id uuid REFERENCES lab.members (id) ON DELETE SET NULL;
-- 거래 내역(최근순) 조회용. 기존 인덱스는 (member_id, reason, created_at)이라 사유를 가리지 않는 목록에 맞지 않는다.
CREATE INDEX coin_events_member_recent_idx ON lab.coin_events (member_id, created_at DESC);

-- 캘린더 할 일: 회원마다 날짜별 할 일(제목 40자)과 완료 여부.
CREATE TABLE lab.todos (
    id uuid PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES lab.members (id) ON DELETE CASCADE,
    due_date date NOT NULL,
    title varchar(40) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 40),
    done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX todos_member_due_idx ON lab.todos (member_id, due_date, created_at);

-- SNS: 회원이 올리는 짧은 글(140자). 탈퇴하면 글도 지운다.
CREATE TABLE lab.sns_posts (
    id uuid PRIMARY KEY,
    author_id uuid NOT NULL REFERENCES lab.members (id) ON DELETE CASCADE,
    content varchar(140) NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 140),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sns_posts_created_idx ON lab.sns_posts (created_at DESC, id DESC);
CREATE INDEX sns_posts_author_created_idx ON lab.sns_posts (author_id, created_at DESC);
