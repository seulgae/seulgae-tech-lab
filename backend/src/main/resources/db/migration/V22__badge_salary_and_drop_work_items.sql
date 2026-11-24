/*
 * 사원증·급여(확장 단계)와 예전 업무 게시판 정리(축소 단계).
 * - 확장: 회원 소지품에 누적 "일 완료" 수와 마지막 급여 시각, 동전 사유 SALARY. 이 릴리스(21..22)의 앱은 아직 쓰지 않는다.
 * - 축소: V21 뒤에 들어온 예전 QA 티켓을 한 번 더 옮긴 다음, 아무 릴리스도 쓰지 않는 예전 업무 게시판 테이블과 코드를 지운다.
 */

/* ---------- 사원증·급여 ---------- */
ALTER TABLE lab.tb_lab_member_inventory
    ADD COLUMN work_count integer NOT NULL DEFAULT 0 CHECK (work_count >= 0),
    ADD COLUMN last_salary_at timestamptz;
COMMENT ON COLUMN lab.tb_lab_member_inventory.work_count IS '누적 일 완료 수(오늘 업무 보상을 받은 날 수). 직급은 이 값으로 계산한다';
COMMENT ON COLUMN lab.tb_lab_member_inventory.last_salary_at IS '마지막으로 급여를 받은 시각(10분마다 지급), 받은 적 없으면 NULL';
COMMENT ON COLUMN lab.tb_lab_member_inventory.fatigue IS '기력(높을수록 좋다: 일·오락으로 줄고 커피·음료로 회복)';
COMMENT ON COLUMN lab.tb_lab_member_inventory.fatigue_max IS '기력 최대치(직급에 따라 오른다)';
COMMENT ON COLUMN lab.tb_lab_member_inventory.hp_max IS 'HP 최대치(직급에 따라 오른다)';

/* 지금까지 받은 오늘 업무 보상 수로 누적 일 완료 수를 채운다. */
UPDATE lab.tb_lab_member_inventory i
SET work_count = c.done
FROM (SELECT member_id, count(*) AS done FROM lab.tb_lab_coin_history WHERE reason = 'DAILY_TASKS' GROUP BY member_id) c
WHERE c.member_id = i.member_id;

INSERT INTO lab.tb_lab_common_code (code_group, code, name, sort_order) VALUES
    ('COIN_REASON', 'SALARY', '급여', 22);

/* ---------- 예전 업무 게시판 정리 ---------- */
INSERT INTO lab.tb_lab_qa_ticket (id, author_id, title, content, status, created_at, updated_at)
SELECT id, author_id, title, content,
       CASE status WHEN 'REGISTERED' THEN 'REGISTERED' WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS' WHEN 'REJECTED' THEN 'IN_PROGRESS' ELSE 'RESOLVED' END,
       created_at, updated_at
FROM lab.tb_lab_work_item WHERE category = 'QA' AND parent_id IS NULL
ON CONFLICT (id) DO NOTHING;

DROP TABLE lab.tb_lab_work_item;
DELETE FROM lab.tb_lab_common_code WHERE code_group IN ('WORK_CATEGORY', 'WORK_STATUS');
