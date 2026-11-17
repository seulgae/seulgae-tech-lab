-- 연구 아이디어 일지 완료 표시. 누구나 체크·해제할 수 있는 공유 상태다.
-- 상수 기본값을 가진 열 추가라 기존 행을 다시 쓰지 않고, 이 열을 모르는 V3 앱도 그대로 동작한다.
ALTER TABLE lab.research_records ADD COLUMN done boolean NOT NULL DEFAULT false;
