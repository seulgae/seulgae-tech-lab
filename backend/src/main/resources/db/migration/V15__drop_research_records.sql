-- 개발 연구실 연구 기록·아이디어 일지 기능을 없앤다(슈퍼컴퓨터는 GitHub PR 목록으로 바뀜).
-- 이 릴리스(14..15)의 앱은 이미 이 테이블을 쓰지 않는다. 인덱스·외래 키는 테이블과 함께 지워진다.
-- migrate-prod.py가 적용 전에 pg_dump 백업을 뜬다. 지운 행은 백업에서만 되살릴 수 있다.
DROP TABLE lab.research_records;
