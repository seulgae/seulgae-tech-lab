-- HP·피로도(연구 아이디어 일지 #10). 회원마다 HP와 피로도를 인벤토리에 둔다. 최대치도 회원별 열로 두어 나중에 늘릴 수 있다(기본 50).
-- 피로도는 "남은 기력"처럼 높을수록 좋다: 일·오락으로 줄고 커피로 회복한다.
ALTER TABLE lab.inventories
    ADD COLUMN hp_max smallint NOT NULL DEFAULT 50 CHECK (hp_max BETWEEN 1 AND 999),
    ADD COLUMN hp smallint NOT NULL DEFAULT 50,
    ADD COLUMN fatigue_max smallint NOT NULL DEFAULT 50 CHECK (fatigue_max BETWEEN 1 AND 999),
    ADD COLUMN fatigue smallint NOT NULL DEFAULT 50,
    ADD CONSTRAINT inventories_hp_range CHECK (hp BETWEEN 0 AND hp_max),
    ADD CONSTRAINT inventories_fatigue_range CHECK (fatigue BETWEEN 0 AND fatigue_max);

-- 로비 데스크 간식 구매(동전 사용 사유)
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'CAKE', '케이크', 3),
    ('COIN_REASON', 'COFFEE', '커피', 4);
