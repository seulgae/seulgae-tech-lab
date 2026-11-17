-- 로비 방명록(연구 아이디어 일지 #9). 게시판 카테고리를 공통코드로 등록하고, 방명록 글은 제목 8자·내용 130자로 제한한다.
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('BOARD_CATEGORY', 'GUESTBOOK', '방명록', 1);

CREATE TABLE lab.guestbook_entries (
    id uuid PRIMARY KEY,
    category_group varchar(30) NOT NULL DEFAULT 'BOARD_CATEGORY' CHECK (category_group = 'BOARD_CATEGORY'),
    category varchar(20) NOT NULL DEFAULT 'GUESTBOOK',
    title varchar(8) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 8),
    content varchar(130) NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 130),
    author_id uuid REFERENCES lab.members (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_group, category) REFERENCES lab.common_codes (code_group, code)
);

CREATE INDEX guestbook_entries_category_created_idx ON lab.guestbook_entries (category, created_at DESC, id DESC);
