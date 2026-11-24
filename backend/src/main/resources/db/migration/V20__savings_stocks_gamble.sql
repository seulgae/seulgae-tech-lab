/*
 * 은행 적금, 주식 앱(가상 종목), 오락실 내기 게임(확장 단계).
 * 이 릴리스(19..20)의 앱은 아직 새 테이블과 사유 코드를 쓰지 않는다. 다음 기능 릴리스(20..20)가 쓴다.
 */

/* ---------- 동전 사유 ---------- */
INSERT INTO lab.tb_lab_common_code (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'SAVINGS_DEPOSIT', '적금 넣음', 14),
    ('COIN_REASON', 'SAVINGS_PAYOUT', '적금 찾음', 15),
    ('COIN_REASON', 'STOCK_BUY', '주식 매수', 16),
    ('COIN_REASON', 'STOCK_SELL', '주식 매도', 17),
    ('COIN_REASON', 'GAMBLE_BET', '오락실 내기', 18),
    ('COIN_REASON', 'GAMBLE_WIN', '오락실 당첨', 19);

/* ---------- 적금 ---------- */
CREATE TABLE lab.tb_lab_savings (
    id uuid PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES lab.tb_lab_member (id) ON DELETE CASCADE,
    principal integer NOT NULL CHECK (principal BETWEEN 1 AND 10000),
    term_days smallint NOT NULL CHECK (term_days IN (1, 3, 7)),
    rate_pct smallint NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    matures_at timestamptz NOT NULL,
    closed_at timestamptz,
    payout integer CHECK (payout >= 0),
    CHECK (matures_at > created_at),
    CHECK ((closed_at IS NULL) = (payout IS NULL))
);
CREATE INDEX tb_lab_savings_member_open_idx ON lab.tb_lab_savings (member_id, closed_at);
COMMENT ON TABLE lab.tb_lab_savings IS '은행 적금: 기간을 정해 넣고 만기에 원금과 이자를 받는다(만기 전 해지는 원금만)';
COMMENT ON COLUMN lab.tb_lab_savings.id IS '적금 ID';
COMMENT ON COLUMN lab.tb_lab_savings.member_id IS '적금을 든 회원';
COMMENT ON COLUMN lab.tb_lab_savings.principal IS '원금(동전)';
COMMENT ON COLUMN lab.tb_lab_savings.term_days IS '기간(일): 1, 3, 7';
COMMENT ON COLUMN lab.tb_lab_savings.rate_pct IS '만기 이자율(%), 가입할 때 정해진다';
COMMENT ON COLUMN lab.tb_lab_savings.created_at IS '가입 시각';
COMMENT ON COLUMN lab.tb_lab_savings.matures_at IS '만기 시각';
COMMENT ON COLUMN lab.tb_lab_savings.closed_at IS '찾은 시각(만기 수령 또는 해지), 진행 중이면 NULL';
COMMENT ON COLUMN lab.tb_lab_savings.payout IS '돌려받은 동전(만기면 원금+이자, 해지면 원금), 진행 중이면 NULL';

/* ---------- 주식 종목(가상) ---------- */
CREATE TABLE lab.tb_lab_stock (
    code varchar(10) PRIMARY KEY CHECK (code ~ '^[A-Z]{2,10}$'),
    name varchar(30) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
    summary varchar(80) NOT NULL,
    price integer NOT NULL CHECK (price BETWEEN 1 AND 100000),
    volatility_pct smallint NOT NULL CHECK (volatility_pct BETWEEN 1 AND 50),
    sort_order smallint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE lab.tb_lab_stock IS '주식 앱 가상 종목: 서버가 일정 간격마다 시세를 무작위로 움직인다';
COMMENT ON COLUMN lab.tb_lab_stock.code IS '종목 코드';
COMMENT ON COLUMN lab.tb_lab_stock.name IS '회사 이름';
COMMENT ON COLUMN lab.tb_lab_stock.summary IS '한 줄 소개';
COMMENT ON COLUMN lab.tb_lab_stock.price IS '현재가(동전)';
COMMENT ON COLUMN lab.tb_lab_stock.volatility_pct IS '한 번 움직일 때 최대 등락폭(%)';
COMMENT ON COLUMN lab.tb_lab_stock.sort_order IS '목록 표시 순서';
COMMENT ON COLUMN lab.tb_lab_stock.updated_at IS '마지막으로 시세를 움직인 시각';

INSERT INTO lab.tb_lab_stock (code, name, summary, price, volatility_pct, sort_order) VALUES
    ('SGLB', '슬개랩', '이 연구소. 꾸준하지만 느리다', 100, 3, 1),
    ('BUGX', '버그잡스', '버그 잡는 로봇 스타트업', 40, 12, 2),
    ('COFE', '커피머신산업', '연구원들의 연료 공급원', 60, 5, 3),
    ('FISH', '강가수산', '낚시꾼이 잡은 물고기를 사들인다', 25, 8, 4),
    ('GPUS', '지피유반도체', '모두가 원하는 칩, 출렁임이 크다', 150, 15, 5),
    ('ARCD', '오락실홀딩스', '사다리·홀짝의 그 회사. 도박 같은 주식', 15, 25, 6);

/* ---------- 시세 기록(차트) ---------- */
CREATE TABLE lab.tb_lab_stock_price (
    stock_code varchar(10) NOT NULL REFERENCES lab.tb_lab_stock (code) ON DELETE CASCADE,
    recorded_at timestamptz NOT NULL,
    price integer NOT NULL CHECK (price BETWEEN 1 AND 100000),
    PRIMARY KEY (stock_code, recorded_at)
);
COMMENT ON TABLE lab.tb_lab_stock_price IS '주식 시세 기록: 시세가 움직일 때마다 한 줄(오래된 기록은 앱이 지운다)';
COMMENT ON COLUMN lab.tb_lab_stock_price.stock_code IS '종목 코드';
COMMENT ON COLUMN lab.tb_lab_stock_price.recorded_at IS '기록 시각';
COMMENT ON COLUMN lab.tb_lab_stock_price.price IS '그 시각의 가격(동전)';

INSERT INTO lab.tb_lab_stock_price (stock_code, recorded_at, price)
SELECT code, CURRENT_TIMESTAMP, price FROM lab.tb_lab_stock;

/* ---------- 회원 보유 주식 ---------- */
CREATE TABLE lab.tb_lab_member_stock (
    member_id uuid NOT NULL REFERENCES lab.tb_lab_member (id) ON DELETE CASCADE,
    stock_code varchar(10) NOT NULL REFERENCES lab.tb_lab_stock (code),
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
    total_cost integer NOT NULL CHECK (total_cost >= 0),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, stock_code)
);
COMMENT ON TABLE lab.tb_lab_member_stock IS '회원이 가진 주식(0주가 되면 행을 지운다)';
COMMENT ON COLUMN lab.tb_lab_member_stock.member_id IS '회원';
COMMENT ON COLUMN lab.tb_lab_member_stock.stock_code IS '종목 코드';
COMMENT ON COLUMN lab.tb_lab_member_stock.quantity IS '보유 수량(주)';
COMMENT ON COLUMN lab.tb_lab_member_stock.total_cost IS '산 금액 합계(동전, 평균 단가 계산용)';
COMMENT ON COLUMN lab.tb_lab_member_stock.updated_at IS '마지막 매수·매도 시각';
