-- 자판기 음료 구매 내역. 기존 프로그램과 호환되는 공통코드 추가만 수행한다.
INSERT INTO lab.common_codes (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'COLA', '콜라', 9),
    ('COIN_REASON', 'CIDER', '사이다', 10),
    ('COIN_REASON', 'FANTA', '환타', 11),
    ('COIN_REASON', 'WATER', '물', 12);
