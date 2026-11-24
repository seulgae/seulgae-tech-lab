/*
 * 게임 규칙 테이블(확장 단계): 코드에 고정돼 있던 행동별 HP·기력 비용, 간식·음료, 직급표를 운영 DB에서 관리한다.
 * 지금 값과 같은 값으로 채운다. 이 릴리스(22..23)의 앱은 아직 코드 값을 쓰고, 다음 기능 릴리스(23..23)가 이 테이블을 읽는다.
 */

/* ---------- 행동별 HP·기력 비용 ---------- */
CREATE TABLE lab.tb_lab_action_cost (
    code varchar(30) PRIMARY KEY CHECK (code ~ '^[A-Z_]{1,30}$'),
    name varchar(30) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
    hp_cost smallint NOT NULL DEFAULT 0 CHECK (hp_cost BETWEEN 0 AND 999),
    fatigue_cost smallint NOT NULL DEFAULT 0 CHECK (fatigue_cost BETWEEN 0 AND 999),
    description varchar(200) NOT NULL DEFAULT '',
    sort_order smallint NOT NULL DEFAULT 0
);
COMMENT ON TABLE lab.tb_lab_action_cost IS '행동별 HP·기력 비용: 모자라면 행동을 막고(423) 하면 뺀다. 연구소장(무제한)은 빼지 않는다';
COMMENT ON COLUMN lab.tb_lab_action_cost.code IS '행동 코드(코드가 이 값으로 비용을 찾는다)';
COMMENT ON COLUMN lab.tb_lab_action_cost.name IS '행동 이름(안내 화면에 보임)';
COMMENT ON COLUMN lab.tb_lab_action_cost.hp_cost IS '한 번에 드는 HP(0이면 HP를 보지 않음)';
COMMENT ON COLUMN lab.tb_lab_action_cost.fatigue_cost IS '한 번에 드는 기력(0이면 기력을 보지 않음)';
COMMENT ON COLUMN lab.tb_lab_action_cost.description IS '어디서 하는 행동인지 설명';
COMMENT ON COLUMN lab.tb_lab_action_cost.sort_order IS '안내 화면 표시 순서';

INSERT INTO lab.tb_lab_action_cost (code, name, hp_cost, fatigue_cost, description, sort_order) VALUES
    ('IDEA_POST', '아이디어 글 올리기', 3, 5, '내 자리 컴퓨터 아이디어 기획 게시판', 1),
    ('QA_REGISTER', 'QA 티켓 등록', 3, 5, '내 자리 컴퓨터 QA 게시판', 2),
    ('QA_MOVE', 'QA 단계 변경', 3, 5, 'QA 티켓을 조치 중·조치 완료로', 3),
    ('ARCADE_PLAY', '오락실 한 판', 3, 5, '오락실 메인 오락기(벽돌 부수기 등)', 4);

/* ---------- 간식·음료 ---------- */
CREATE TABLE lab.tb_lab_snack (
    code varchar(30) PRIMARY KEY CHECK (code ~ '^[A-Z_]{1,30}$'),
    name varchar(30) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
    price smallint NOT NULL CHECK (price BETWEEN 1 AND 999),
    hp_gain smallint NOT NULL DEFAULT 0 CHECK (hp_gain BETWEEN 0 AND 999),
    fatigue_gain smallint NOT NULL DEFAULT 0 CHECK (fatigue_gain BETWEEN 0 AND 999),
    place varchar(10) NOT NULL CHECK (place IN ('LOBBY', 'VENDING')),
    sort_order smallint NOT NULL DEFAULT 0,
    CHECK (hp_gain > 0 OR fatigue_gain > 0)
);
COMMENT ON TABLE lab.tb_lab_snack IS '간식·음료: 가격과 회복량. 코드는 동전 사유(COIN_REASON)와 같아야 거래 내역에 이름이 나온다';
COMMENT ON COLUMN lab.tb_lab_snack.code IS '간식 코드(공통코드 COIN_REASON에도 같은 코드가 있어야 한다)';
COMMENT ON COLUMN lab.tb_lab_snack.name IS '이름';
COMMENT ON COLUMN lab.tb_lab_snack.price IS '가격(동전)';
COMMENT ON COLUMN lab.tb_lab_snack.hp_gain IS 'HP 회복량(최대치에서 멈춤)';
COMMENT ON COLUMN lab.tb_lab_snack.fatigue_gain IS '기력 회복량(최대치에서 멈춤)';
COMMENT ON COLUMN lab.tb_lab_snack.place IS '파는 곳: LOBBY(로비 데스크), VENDING(로비 자판기)';
COMMENT ON COLUMN lab.tb_lab_snack.sort_order IS '표시 순서';

INSERT INTO lab.tb_lab_snack (code, name, price, hp_gain, fatigue_gain, place, sort_order) VALUES
    ('CAKE', '케이크', 3, 10, 0, 'LOBBY', 1),
    ('COFFEE', '커피', 2, 0, 5, 'LOBBY', 2),
    ('COLA', '콜라', 2, 0, 5, 'VENDING', 3),
    ('CIDER', '사이다', 2, 0, 5, 'VENDING', 4),
    ('FANTA', '환타', 2, 0, 5, 'VENDING', 5),
    ('WATER', '물', 1, 0, 2, 'VENDING', 6);

/* ---------- 직급 ---------- */
CREATE TABLE lab.tb_lab_rank (
    code varchar(20) PRIMARY KEY CHECK (code ~ '^[A-Z_]{1,20}$'),
    name varchar(20) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 20),
    min_work integer NOT NULL UNIQUE CHECK (min_work >= 0),
    salary smallint NOT NULL CHECK (salary BETWEEN 0 AND 9999),
    vitals_max smallint NOT NULL CHECK (vitals_max BETWEEN 1 AND 999),
    unlimited boolean NOT NULL DEFAULT false,
    sort_order smallint NOT NULL DEFAULT 0
);
COMMENT ON TABLE lab.tb_lab_rank IS '연구소 직급: 누적 일 완료 수(min_work) 이상이면 그 직급. 0인 직급이 반드시 하나 있어야 한다';
COMMENT ON COLUMN lab.tb_lab_rank.code IS '직급 코드';
COMMENT ON COLUMN lab.tb_lab_rank.name IS '직급 이름';
COMMENT ON COLUMN lab.tb_lab_rank.min_work IS '승진 조건: 누적 일 완료 수(오늘 업무 보상을 받은 날 수)';
COMMENT ON COLUMN lab.tb_lab_rank.salary IS '접속 중 10분마다 받는 급여(동전)';
COMMENT ON COLUMN lab.tb_lab_rank.vitals_max IS 'HP·기력 최대치(승진할 때 이 값으로 올리고 가득 채운다)';
COMMENT ON COLUMN lab.tb_lab_rank.unlimited IS 'HP·기력 무제한(행동 비용을 빼지 않음)';
COMMENT ON COLUMN lab.tb_lab_rank.sort_order IS '표시 순서';

INSERT INTO lab.tb_lab_rank (code, name, min_work, salary, vitals_max, unlimited, sort_order) VALUES
    ('INTERN', '인턴', 0, 1, 50, false, 1),
    ('JUNIOR', '주임', 1, 5, 100, false, 2),
    ('SENIOR', '선임', 5, 10, 150, false, 3),
    ('PRINCIPAL', '책임', 10, 20, 220, false, 4),
    ('CHIEF', '수석', 30, 50, 500, false, 5),
    ('DIRECTOR', '연구소장', 100, 100, 999, true, 6);
