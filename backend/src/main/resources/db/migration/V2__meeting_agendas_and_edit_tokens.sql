-- 로그인 없이 작성한 브라우저만 수정·삭제할 수 있도록 수정 키의 SHA-256 해시를 저장한다.
-- 기존 V1 기록은 해시가 없으므로 수정·삭제할 수 없다. 원문 키는 저장하지 않는다.
ALTER TABLE lab.research_records
    ADD COLUMN edit_token_hash char(64) CHECK (edit_token_hash ~ '^[0-9a-f]{64}$'),
    ADD COLUMN updated_at timestamptz;

-- 회의실 화이트보드 안건. 제목은 칠판에 한 줄로 보이는 8자, 내용은 130자까지다.
CREATE TABLE lab.meeting_agendas (
    id uuid PRIMARY KEY,
    title varchar(8) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 8),
    content varchar(130) NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 130),
    edit_token_hash char(64) NOT NULL CHECK (edit_token_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz
);

CREATE INDEX meeting_agendas_created_at_id_idx
    ON lab.meeting_agendas (created_at DESC, id DESC);
