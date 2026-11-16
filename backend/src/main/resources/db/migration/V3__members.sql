-- 카카오 로그인 회원. 처음 로그인할 때 만들어진다(회원가입). 카카오 식별자 외 개인정보는 저장하지 않는다.
CREATE TABLE lab.members (
    id uuid PRIMARY KEY,
    kakao_id bigint NOT NULL UNIQUE,
    nickname varchar(16) NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 16),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 로그인한 회원이 쓴 글의 작성자. 로그인 전 글(수정 키 방식)은 NULL로 남는다.
ALTER TABLE lab.meeting_agendas ADD COLUMN author_id uuid REFERENCES lab.members (id) ON DELETE SET NULL;
ALTER TABLE lab.research_records ADD COLUMN author_id uuid REFERENCES lab.members (id) ON DELETE SET NULL;

CREATE INDEX meeting_agendas_author_id_idx ON lab.meeting_agendas (author_id);
CREATE INDEX research_records_author_id_idx ON lab.research_records (author_id);
