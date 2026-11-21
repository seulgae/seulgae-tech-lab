-- 포장마차 물고기 판매(저녁에만, 한 마리 최대 30원). 동전 변동 기록의 사유 공통코드만 추가한다.
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'FISH_SALE', '물고기 판매', 6);
