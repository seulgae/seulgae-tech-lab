-- 식물 행운(화분을 흔들면 5% 확률로 1~3원). 동전 변동 기록의 사유 공통코드만 추가한다.
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'PLANT_LUCK', '식물 행운', 5);
