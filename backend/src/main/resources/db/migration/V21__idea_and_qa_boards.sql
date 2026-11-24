/*
 * 서비스 연구실 게시판 개편(확장 단계): 아이디어 기획 게시판, 새 QA 게시판(등록 → 조치 중 → 조치 완료),
 * 내 자리 컴퓨터의 오늘 업무 보상·자바 연습 동전 사유.
 * 이 릴리스(20..21)의 앱은 아직 예전 업무 게시판(tb_lab_work_item)을 쓴다. 다음 기능 릴리스(21..21)가 새 테이블을 쓰고,
 * 그 뒤 축소 단계(V22)가 V21 이후에 들어온 QA 티켓을 한 번 더 옮긴 다음 예전 테이블과 코드를 지운다.
 */

/* ---------- 코드 ---------- */
INSERT INTO lab.tb_lab_common_code (code_group, code, name, sort_order) VALUES
    ('QA_STATUS', 'REGISTERED', '등록', 1),
    ('QA_STATUS', 'IN_PROGRESS', '조치 중', 2),
    ('QA_STATUS', 'RESOLVED', '조치 완료', 3),
    ('COIN_REASON', 'JAVA_PRACTICE', '자바 연습 문제', 20),
    ('COIN_REASON', 'DAILY_TASKS', '오늘 업무 완료', 21);

/* ---------- 아이디어 기획 게시판 ---------- */
CREATE TABLE lab.tb_lab_idea_post (
    id uuid PRIMARY KEY,
    author_id uuid REFERENCES lab.tb_lab_member (id) ON DELETE SET NULL,
    title varchar(60) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
    content varchar(1000) NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX tb_lab_idea_post_created_idx ON lab.tb_lab_idea_post (created_at DESC, id DESC);
COMMENT ON TABLE lab.tb_lab_idea_post IS '아이디어 기획 게시판: 게임 개발에 도움이 될 아이디어 글';
COMMENT ON COLUMN lab.tb_lab_idea_post.id IS '글 ID';
COMMENT ON COLUMN lab.tb_lab_idea_post.author_id IS '쓴 회원(탈퇴하면 NULL)';
COMMENT ON COLUMN lab.tb_lab_idea_post.title IS '제목(1~60자)';
COMMENT ON COLUMN lab.tb_lab_idea_post.content IS '내용(1~1000자)';
COMMENT ON COLUMN lab.tb_lab_idea_post.created_at IS '쓴 시각';

/* ---------- QA 게시판 ---------- */
CREATE TABLE lab.tb_lab_qa_ticket (
    id uuid PRIMARY KEY,
    author_id uuid REFERENCES lab.tb_lab_member (id) ON DELETE SET NULL,
    title varchar(60) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
    content varchar(1000) NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
    status_group varchar(30) NOT NULL DEFAULT 'QA_STATUS' CHECK (status_group = 'QA_STATUS'),
    status varchar(20) NOT NULL DEFAULT 'REGISTERED',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz,
    FOREIGN KEY (status_group, status) REFERENCES lab.tb_lab_common_code (code_group, code)
);
CREATE INDEX tb_lab_qa_ticket_created_idx ON lab.tb_lab_qa_ticket (created_at DESC, id DESC);
COMMENT ON TABLE lab.tb_lab_qa_ticket IS 'QA 게시판 티켓: 등록 → 조치 중 → 조치 완료 순으로만 진행한다';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.id IS '티켓 ID(예전 업무 게시판에서 옮긴 티켓은 같은 ID)';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.author_id IS '등록한 회원(탈퇴하면 NULL)';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.title IS '제목(1~60자)';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.content IS '내용(1~1000자)';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.status_group IS '상태 코드 그룹(QA_STATUS 고정)';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.status IS '진행 상태(등록·조치 중·조치 완료)';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.created_at IS '등록 시각';
COMMENT ON COLUMN lab.tb_lab_qa_ticket.updated_at IS '마지막으로 상태를 바꾼 시각';

/* ---------- 예전 QA 티켓 옮기기(최종 승인 → 조치 완료, 반려 → 조치 중) ---------- */
INSERT INTO lab.tb_lab_qa_ticket (id, author_id, title, content, status, created_at, updated_at)
SELECT id, author_id, title, content,
       CASE status WHEN 'REGISTERED' THEN 'REGISTERED' WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS' WHEN 'REJECTED' THEN 'IN_PROGRESS' ELSE 'RESOLVED' END,
       created_at, updated_at
FROM lab.tb_lab_work_item WHERE category = 'QA' AND parent_id IS NULL;
