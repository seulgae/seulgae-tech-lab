/*
 * 테이블 이름 규칙 정리(확장 단계): 모든 테이블을 tb_lab_<명시적 이름>(단수)으로 바꾸고 테이블·컬럼 주석을 단다.
 * 이름을 바꾼 뒤 예전 이름의 호환 뷰를 만들어, 지금 돌아가는 V16 앱(예전 이름 사용)이 그대로 읽고 쓰게 한다.
 * 단순 뷰(한 테이블, SELECT *)는 PostgreSQL이 자동으로 갱신 가능 뷰로 다루므로 INSERT·UPDATE·DELETE·RETURNING이 그대로 동작한다.
 * 새 이름을 쓰는 앱이 배포된 뒤 V18에서 호환 뷰를 지운다. 인덱스·제약 이름은 바꾸지 않는다(동작과 무관).
 */

/* ---------- 이름 변경 ---------- */
ALTER TABLE lab.members RENAME TO tb_lab_member;
ALTER TABLE lab.common_codes RENAME TO tb_lab_common_code;
ALTER TABLE lab.work_items RENAME TO tb_lab_work_item;
ALTER TABLE lab.inventories RENAME TO tb_lab_member_inventory;
ALTER TABLE lab.coin_events RENAME TO tb_lab_coin_history;
ALTER TABLE lab.items RENAME TO tb_lab_item;
ALTER TABLE lab.guestbook_entries RENAME TO tb_lab_guestbook;
ALTER TABLE lab.meeting_agendas RENAME TO tb_lab_meeting_agenda;
ALTER TABLE lab.level_requests RENAME TO tb_lab_level_request;
ALTER TABLE lab.todos RENAME TO tb_lab_todo;
ALTER TABLE lab.sns_posts RENAME TO tb_lab_sns_post;

/* ---------- 예전 이름의 호환 뷰(V18에서 삭제) ---------- */
CREATE VIEW lab.members AS SELECT * FROM lab.tb_lab_member;
CREATE VIEW lab.common_codes AS SELECT * FROM lab.tb_lab_common_code;
CREATE VIEW lab.work_items AS SELECT * FROM lab.tb_lab_work_item;
CREATE VIEW lab.inventories AS SELECT * FROM lab.tb_lab_member_inventory;
CREATE VIEW lab.coin_events AS SELECT * FROM lab.tb_lab_coin_history;
CREATE VIEW lab.items AS SELECT * FROM lab.tb_lab_item;
CREATE VIEW lab.guestbook_entries AS SELECT * FROM lab.tb_lab_guestbook;
CREATE VIEW lab.meeting_agendas AS SELECT * FROM lab.tb_lab_meeting_agenda;
CREATE VIEW lab.level_requests AS SELECT * FROM lab.tb_lab_level_request;
CREATE VIEW lab.todos AS SELECT * FROM lab.tb_lab_todo;
CREATE VIEW lab.sns_posts AS SELECT * FROM lab.tb_lab_sns_post;

/* ---------- 회원 ---------- */
COMMENT ON TABLE lab.tb_lab_member IS '회원: 카카오 로그인 회원과 등급';
COMMENT ON COLUMN lab.tb_lab_member.id IS '회원 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_member.kakao_id IS '카카오 회원번호(유일)';
COMMENT ON COLUMN lab.tb_lab_member.nickname IS '닉네임(1~16자, 로비 이름표)';
COMMENT ON COLUMN lab.tb_lab_member.created_at IS '가입 일시';
COMMENT ON COLUMN lab.tb_lab_member.last_login_at IS '마지막 로그인 일시';
COMMENT ON COLUMN lab.tb_lab_member.level IS '회원 등급(1 일반 사용자, 2 운영자, 3 관리자)';

/* ---------- 공통코드 ---------- */
COMMENT ON TABLE lab.tb_lab_common_code IS '공통코드: 코드 그룹별 코드와 표시 이름(게시판 분류·상태, 동전 사유, 아이템 종류 등)';
COMMENT ON COLUMN lab.tb_lab_common_code.code_group IS '코드 그룹(예: WORK_STATUS, COIN_REASON)';
COMMENT ON COLUMN lab.tb_lab_common_code.code IS '코드(대문자·밑줄 1~20자)';
COMMENT ON COLUMN lab.tb_lab_common_code.name IS '화면 표시 이름';
COMMENT ON COLUMN lab.tb_lab_common_code.sort_order IS '그룹 안 정렬 순서';

/* ---------- 업무 게시판 ---------- */
COMMENT ON TABLE lab.tb_lab_work_item IS '업무 게시판 글: QA 티켓과 그 아래 유지보수 조치·운영 점검 기록';
COMMENT ON COLUMN lab.tb_lab_work_item.id IS '글 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_work_item.parent_id IS '연결된 QA 티켓 ID(QA 글은 NULL)';
COMMENT ON COLUMN lab.tb_lab_work_item.category_group IS '분류 코드 그룹(WORK_CATEGORY 고정)';
COMMENT ON COLUMN lab.tb_lab_work_item.category IS '분류(QA, MAINTENANCE, OPERATION)';
COMMENT ON COLUMN lab.tb_lab_work_item.status_group IS '상태 코드 그룹(WORK_STATUS 고정)';
COMMENT ON COLUMN lab.tb_lab_work_item.status IS '진행 상태(등록·조치 중·조치 완료·최종 승인·반려)';
COMMENT ON COLUMN lab.tb_lab_work_item.title IS '제목(1~60자)';
COMMENT ON COLUMN lab.tb_lab_work_item.content IS '내용(1~1000자)';
COMMENT ON COLUMN lab.tb_lab_work_item.guide IS '조치 안내(선택)';
COMMENT ON COLUMN lab.tb_lab_work_item.author_id IS '작성 회원 ID(탈퇴 시 NULL)';
COMMENT ON COLUMN lab.tb_lab_work_item.created_at IS '작성 일시';
COMMENT ON COLUMN lab.tb_lab_work_item.updated_at IS '수정 일시';

/* ---------- 회원 소지품(동전·HP·피로도) ---------- */
COMMENT ON TABLE lab.tb_lab_member_inventory IS '회원 소지품: 동전 잔액과 HP·피로도(회원당 한 행)';
COMMENT ON COLUMN lab.tb_lab_member_inventory.member_id IS '회원 ID';
COMMENT ON COLUMN lab.tb_lab_member_inventory.coins IS '동전 잔액(0 이상)';
COMMENT ON COLUMN lab.tb_lab_member_inventory.updated_at IS '마지막 변경 일시';
COMMENT ON COLUMN lab.tb_lab_member_inventory.hp_max IS 'HP 최대치';
COMMENT ON COLUMN lab.tb_lab_member_inventory.hp IS '현재 HP';
COMMENT ON COLUMN lab.tb_lab_member_inventory.fatigue_max IS '피로도 최대치';
COMMENT ON COLUMN lab.tb_lab_member_inventory.fatigue IS '현재 피로도(남은 기력, 높을수록 좋음)';

/* ---------- 동전 변동 이력 ---------- */
COMMENT ON TABLE lab.tb_lab_coin_history IS '동전 변동 이력: 보상·구매·판매·송금 한 건씩(은행 거래 내역, 하루 한도 계산)';
COMMENT ON COLUMN lab.tb_lab_coin_history.id IS '이력 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_coin_history.member_id IS '회원 ID';
COMMENT ON COLUMN lab.tb_lab_coin_history.amount IS '변동량(+ 받음, - 씀)';
COMMENT ON COLUMN lab.tb_lab_coin_history.reason_group IS '사유 코드 그룹(COIN_REASON 고정)';
COMMENT ON COLUMN lab.tb_lab_coin_history.reason IS '사유(WORK_POST, ARCADE_PLAY, CAKE, TRANSFER_OUT 등)';
COMMENT ON COLUMN lab.tb_lab_coin_history.created_at IS '변동 일시';
COMMENT ON COLUMN lab.tb_lab_coin_history.counterpart_id IS '송금 상대 회원 ID(송금이 아니면 NULL)';

/* ---------- 아이템 ---------- */
COMMENT ON TABLE lab.tb_lab_item IS '아이템: 회원 보관함(주인 있음) 또는 방 바닥(주인 없음, 위치 있음)의 물고기 등';
COMMENT ON COLUMN lab.tb_lab_item.id IS '아이템 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_item.owner_id IS '주인 회원 ID(바닥에 있으면 NULL)';
COMMENT ON COLUMN lab.tb_lab_item.kind_group IS '종류 코드 그룹(ITEM_KIND 고정)';
COMMENT ON COLUMN lab.tb_lab_item.kind IS '종류(FISH)';
COMMENT ON COLUMN lab.tb_lab_item.name IS '이름(어종 등, 1~30자)';
COMMENT ON COLUMN lab.tb_lab_item.size_cm IS '크기(cm, 물고기)';
COMMENT ON COLUMN lab.tb_lab_item.room_id IS '바닥에 놓인 방 ID';
COMMENT ON COLUMN lab.tb_lab_item.x IS '바닥 위치 x(px)';
COMMENT ON COLUMN lab.tb_lab_item.y IS '바닥 위치 y(px)';
COMMENT ON COLUMN lab.tb_lab_item.created_at IS '생성(획득) 일시';

/* ---------- 방명록 ---------- */
COMMENT ON TABLE lab.tb_lab_guestbook IS '로비 방명록 글';
COMMENT ON COLUMN lab.tb_lab_guestbook.id IS '글 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_guestbook.category_group IS '게시판 코드 그룹(BOARD_CATEGORY 고정)';
COMMENT ON COLUMN lab.tb_lab_guestbook.category IS '게시판(GUESTBOOK)';
COMMENT ON COLUMN lab.tb_lab_guestbook.title IS '제목(1~8자)';
COMMENT ON COLUMN lab.tb_lab_guestbook.content IS '내용(1~130자)';
COMMENT ON COLUMN lab.tb_lab_guestbook.author_id IS '작성 회원 ID(비회원·탈퇴 시 NULL)';
COMMENT ON COLUMN lab.tb_lab_guestbook.created_at IS '작성 일시';

/* ---------- 회의 안건 ---------- */
COMMENT ON TABLE lab.tb_lab_meeting_agenda IS '회의실 화이트보드 회의 안건';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.id IS '안건 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.title IS '제목(1~8자)';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.content IS '내용(1~130자)';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.edit_token_hash IS '수정 키의 SHA-256 해시(원문은 작성자 브라우저에만)';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.created_at IS '작성 일시';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.updated_at IS '수정 일시';
COMMENT ON COLUMN lab.tb_lab_meeting_agenda.author_id IS '작성 회원 ID(비회원·탈퇴 시 NULL)';

/* ---------- 등급 신청 ---------- */
COMMENT ON TABLE lab.tb_lab_level_request IS '회원 등급 신청(운영자·관리자)과 승인·반려 결과';
COMMENT ON COLUMN lab.tb_lab_level_request.id IS '신청 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_level_request.member_id IS '신청 회원 ID';
COMMENT ON COLUMN lab.tb_lab_level_request.requested_level IS '신청 등급(2 운영자, 3 관리자)';
COMMENT ON COLUMN lab.tb_lab_level_request.reason IS '신청 사유(1~200자)';
COMMENT ON COLUMN lab.tb_lab_level_request.status_group IS '상태 코드 그룹(REQUEST_STATUS 고정)';
COMMENT ON COLUMN lab.tb_lab_level_request.status IS '상태(PENDING 검토 중, APPROVED 승인, REJECTED 반려)';
COMMENT ON COLUMN lab.tb_lab_level_request.created_at IS '신청 일시';
COMMENT ON COLUMN lab.tb_lab_level_request.decided_at IS '승인·반려 일시';
COMMENT ON COLUMN lab.tb_lab_level_request.decided_by IS '처리한 관리자 회원 ID';

/* ---------- 폰 캘린더 할 일 ---------- */
COMMENT ON TABLE lab.tb_lab_todo IS '폰 캘린더 할 일(회원별)';
COMMENT ON COLUMN lab.tb_lab_todo.id IS '할 일 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_todo.member_id IS '회원 ID';
COMMENT ON COLUMN lab.tb_lab_todo.due_date IS '날짜';
COMMENT ON COLUMN lab.tb_lab_todo.title IS '제목(1~40자)';
COMMENT ON COLUMN lab.tb_lab_todo.done IS '완료 여부';
COMMENT ON COLUMN lab.tb_lab_todo.created_at IS '등록 일시';

/* ---------- 폰 SNS ---------- */
COMMENT ON TABLE lab.tb_lab_sns_post IS '폰 SNS(슬개그램) 글';
COMMENT ON COLUMN lab.tb_lab_sns_post.id IS '글 ID(UUID)';
COMMENT ON COLUMN lab.tb_lab_sns_post.author_id IS '작성 회원 ID';
COMMENT ON COLUMN lab.tb_lab_sns_post.content IS '내용(1~140자)';
COMMENT ON COLUMN lab.tb_lab_sns_post.created_at IS '작성 일시';
