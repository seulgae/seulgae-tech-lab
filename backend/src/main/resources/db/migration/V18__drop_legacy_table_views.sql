/*
 * 테이블 이름 규칙 정리(축소 단계): V17에서 남긴 예전 이름의 호환 뷰를 지운다.
 * 이 릴리스(17..18)의 앱은 이미 tb_lab_ 새 이름만 쓴다. 뷰만 지우므로 데이터는 바뀌지 않는다.
 */
DROP VIEW lab.members;
DROP VIEW lab.common_codes;
DROP VIEW lab.work_items;
DROP VIEW lab.inventories;
DROP VIEW lab.coin_events;
DROP VIEW lab.items;
DROP VIEW lab.guestbook_entries;
DROP VIEW lab.meeting_agendas;
DROP VIEW lab.level_requests;
DROP VIEW lab.todos;
DROP VIEW lab.sns_posts;
