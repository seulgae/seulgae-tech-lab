/*
 * HP·기력 규칙 넓히기(확장 단계): 새 행동 비용, 회복 간식 두 가지, 기숙사 침대 휴식 규칙과 휴식 시각 열.
 * 이 릴리스(23..24)의 앱은 새 행동 비용·휴식을 아직 쓰지 않고, 다음 기능 릴리스(24..24)가 쓴다.
 * 새 간식은 자판기(place = VENDING)에 바로 보이고 살 수 있다(지금 앱도 표를 읽어 버튼을 만든다).
 */

/* ---------- 새 행동 비용 ---------- */
INSERT INTO lab.tb_lab_action_cost (code, name, hp_cost, fatigue_cost, description, sort_order) VALUES
    ('GAMBLE_BET', '오락실 내기 한 판', 0, 3, '오락실 홀짝·사다리', 5),
    ('FISH_CATCH', '물고기 낚기', 0, 4, '낚은 물고기를 보관함에 넣을 때', 6),
    ('JAVA_ANSWER', '자바 연습 문제 풀기', 0, 2, '내 자리 컴퓨터 자바 연습(답 제출마다)', 7),
    ('STOCK_TRADE', '주식 거래', 0, 1, '폰 주식 앱 사기·팔기', 8),
    ('FURNITURE_PLACE', '가구 배치', 2, 0, '개인 기숙사에 가구 놓기', 9);

/* ---------- 새 회복 간식(자판기) ---------- */
INSERT INTO lab.tb_lab_common_code (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'LUNCHBOX', '도시락', 23),
    ('COIN_REASON', 'ENERGY_DRINK', '에너지드링크', 24);
INSERT INTO lab.tb_lab_snack (code, name, price, hp_gain, fatigue_gain, place, sort_order) VALUES
    ('LUNCHBOX', '도시락', 6, 25, 0, 'VENDING', 7),
    ('ENERGY_DRINK', '에너지드링크', 5, 0, 20, 'VENDING', 8);

/* ---------- 숫자 규칙(키 → 값) ---------- */
CREATE TABLE lab.tb_lab_game_rule (
    code varchar(30) PRIMARY KEY CHECK (code ~ '^[A-Z_]{1,30}$'),
    name varchar(40) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    value integer NOT NULL CHECK (value BETWEEN 0 AND 100000),
    description varchar(200) NOT NULL DEFAULT '',
    sort_order smallint NOT NULL DEFAULT 0
);
COMMENT ON TABLE lab.tb_lab_game_rule IS '숫자 게임 규칙(키 → 값): 코드에 있던 한도·회복량 등을 운영자가 바꿀 수 있게 한 값. 코드가 code로 찾는다';
COMMENT ON COLUMN lab.tb_lab_game_rule.code IS '규칙 코드(코드가 이 값으로 찾는다, 바꾸지 않음)';
COMMENT ON COLUMN lab.tb_lab_game_rule.name IS '규칙 이름(안내 화면에 보임)';
COMMENT ON COLUMN lab.tb_lab_game_rule.value IS '규칙 값(0~100000, 단위는 description에 적는다)';
COMMENT ON COLUMN lab.tb_lab_game_rule.description IS '단위와 뜻';
COMMENT ON COLUMN lab.tb_lab_game_rule.sort_order IS '안내 화면 표시 순서';

INSERT INTO lab.tb_lab_game_rule (code, name, value, description, sort_order) VALUES
    ('REST_EVERY_SEC', '침대 휴식 간격', 60, '침대에 누워 있으면 이 초마다 한 번 회복한다(초)', 1),
    ('REST_HP', '침대 휴식 HP 회복', 3, '한 번 회복할 때 오르는 HP', 2),
    ('REST_FATIGUE', '침대 휴식 기력 회복', 3, '한 번 회복할 때 오르는 기력', 3);

/* ---------- 휴식 시각 ---------- */
ALTER TABLE lab.tb_lab_member_inventory ADD COLUMN last_rest_at timestamptz;
COMMENT ON COLUMN lab.tb_lab_member_inventory.last_rest_at IS '마지막으로 침대 휴식 회복을 받은 시각(간격 확인), 받은 적 없으면 NULL';
