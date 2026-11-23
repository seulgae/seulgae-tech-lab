/*
 * 개인 기숙사 가구(확장 단계): 가구 카탈로그, 회원이 산 가구(보관·배치), 가구 구매 동전 사유.
 * 이 릴리스(18..19)의 앱은 아직 새 테이블을 쓰지 않는다. 다음 기능 릴리스(19..19)가 쓴다.
 */

/* ---------- 가구 구매 동전 사유 ---------- */
INSERT INTO lab.tb_lab_common_code (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'FURNITURE_BUY', '가구 구매', 13);

/* ---------- 가구 카탈로그 ---------- */
CREATE TABLE lab.tb_lab_furniture (
    code varchar(30) PRIMARY KEY CHECK (code ~ '^[A-Z_]{1,30}$'),
    name varchar(30) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
    price integer NOT NULL CHECK (price BETWEEN 1 AND 999),
    width smallint NOT NULL CHECK (width BETWEEN 8 AND 400),
    height smallint NOT NULL CHECK (height BETWEEN 8 AND 400),
    blocking boolean NOT NULL DEFAULT true,
    sort_order smallint NOT NULL DEFAULT 0
);
COMMENT ON TABLE lab.tb_lab_furniture IS '가구 카탈로그: 폰 가구점에서 파는 가구와 가격·바닥 크기';
COMMENT ON COLUMN lab.tb_lab_furniture.code IS '가구 코드(화면 그림과 연결)';
COMMENT ON COLUMN lab.tb_lab_furniture.name IS '가구 이름';
COMMENT ON COLUMN lab.tb_lab_furniture.price IS '가격(동전)';
COMMENT ON COLUMN lab.tb_lab_furniture.width IS '바닥 차지 너비(px, 충돌·겹침 판정)';
COMMENT ON COLUMN lab.tb_lab_furniture.height IS '바닥 차지 깊이(px, 충돌·겹침 판정)';
COMMENT ON COLUMN lab.tb_lab_furniture.blocking IS '캐릭터가 부딪히는지(러그처럼 바닥에 까는 가구는 false)';
COMMENT ON COLUMN lab.tb_lab_furniture.sort_order IS '가구점 표시 순서';

INSERT INTO lab.tb_lab_furniture (code, name, price, width, height, blocking, sort_order) VALUES
    ('BED', '침대', 25, 92, 56, true, 1),
    ('DESK', '책상', 15, 112, 40, true, 2),
    ('COMPUTER', '컴퓨터 책상', 22, 112, 40, true, 3),
    ('CHAIR', '의자', 5, 28, 24, true, 4),
    ('ARMCHAIR', '안락의자', 9, 32, 24, true, 5),
    ('SOFA', '소파', 18, 104, 40, true, 6),
    ('BOOKSHELF', '책장', 12, 56, 28, true, 7),
    ('PLANT', '화분', 4, 28, 20, true, 8),
    ('TALL_PLANT', '큰 화분', 7, 28, 20, true, 9),
    ('LAMP', '스탠드 조명', 6, 20, 16, true, 10),
    ('WHITEBOARD', '화이트보드', 10, 104, 24, true, 11),
    ('COFFEE_MACHINE', '커피 머신', 14, 28, 20, true, 12),
    ('ARCADE', '오락기', 30, 56, 32, true, 13),
    ('RUG', '러그', 6, 96, 64, false, 14);

/* ---------- 회원이 산 가구 ---------- */
CREATE TABLE lab.tb_lab_member_furniture (
    id uuid PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES lab.tb_lab_member (id) ON DELETE CASCADE,
    furniture_code varchar(30) NOT NULL REFERENCES lab.tb_lab_furniture (code),
    placed boolean NOT NULL DEFAULT false,
    x smallint CHECK (x BETWEEN 0 AND 800),
    y smallint CHECK (y BETWEEN 0 AND 600),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    placed_at timestamptz,
    /* 배치했으면 위치가 있고, 보관 중이면 위치가 없다 */
    CHECK (placed = (x IS NOT NULL AND y IS NOT NULL))
);
CREATE INDEX tb_lab_member_furniture_member_idx ON lab.tb_lab_member_furniture (member_id, placed);
COMMENT ON TABLE lab.tb_lab_member_furniture IS '회원이 산 가구: 보관함에 있거나 개인 기숙사에 배치됨';
COMMENT ON COLUMN lab.tb_lab_member_furniture.id IS '가구 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_member_furniture.member_id IS '주인 회원 ID';
COMMENT ON COLUMN lab.tb_lab_member_furniture.furniture_code IS '가구 코드(카탈로그)';
COMMENT ON COLUMN lab.tb_lab_member_furniture.placed IS '기숙사에 배치했는지(false면 보관함)';
COMMENT ON COLUMN lab.tb_lab_member_furniture.x IS '배치 위치 x(px, 바닥 가운데)';
COMMENT ON COLUMN lab.tb_lab_member_furniture.y IS '배치 위치 y(px, 바닥 아래 끝)';
COMMENT ON COLUMN lab.tb_lab_member_furniture.created_at IS '구매 일시';
COMMENT ON COLUMN lab.tb_lab_member_furniture.placed_at IS '마지막 배치 일시';
