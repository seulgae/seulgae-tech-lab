# 백엔드 패키지 구조 (2026-11-23)

`backend/src/main/java/kr/seulgae/techlab/` 아래는 **기능별 폴더 → 계층별 폴더**로 나눈다. 테스트(`src/test/java`)도 같은 구조를 따른다. 테스트는 대상 클래스와 같은 패키지에 둔다.

```
<기능>/
  controller/        HTTP API(@RestController). 서비스 인터페이스만 의존한다.
  dto/               화면·API로 주고받는 값(record, 이름 끝 DTO)
  entity/            tb_lab_* 테이블 한 행을 담는 값(record)
  repository/        저장소 인터페이스
    impl/            JdbcXxxRepository(SQL 구현). 테스트에는 InMemoryXxxRepository를 둔다.
  service/           서비스 인터페이스(기능 명세, 공개 상수)
    impl/            XxxServiceImpl(@Service, 실제 구현)
  (필요할 때만) config/ support/ client/ event/ domain/
```

| 기능 | 폴더 | 내용 |
|---|---|---|
| 관리자 | `admin` | 관리자 판단(AdminAccess), 쿼리 콘솔(SqlConsoleService) |
| 회원·등급 | `auth` | 카카오 로그인(client/KakaoClient), 세션(support), 회원·등급 신청 |
| 소지품·은행 | `inventory` | 동전·HP·아이템, 자판기, 포장마차, 송금 |
| 서버 용량 | `lab/capacity` | SSH 수집(client/SshProbe), 프로브 출력(domain/HostMetrics) |
| PR 목록 | `lab/pulls` | GitHub PR 목록 |
| 연구소 상태 | `lab/status` | 빌드 정보·상태 |
| 방명록 | `lobby/guestbook` | 로비 방명록 |
| 회의 안건 | `meeting/agendas` | 회의실 화이트보드 안건 |
| 업무 게시판 | `office/work` | QA·유지보수·운영 게시판 |
| 폰 | `phone` | 캘린더 할 일, SNS |
| 공통 | `common` | 쓰기 제한·수정 키·오류 처리 |
| 멀티플레이 | `multiplayer/lobby` | WebSocket(config·websocket·domain), 계층 구조와 다르게 실시간 처리 단위로 나눈다 |

## 규칙

- **controller → service(인터페이스) → repository(인터페이스)** 방향으로만 의존한다. `impl` 패키지는 다른 계층이 직접 가져다 쓰지 않는다(스프링이 주입한다).
- 서비스의 공개 상수(예: `BankService.TRANSFER_MAX`)는 인터페이스에 둔다. 구현 전용 도우미(정적 메서드 등)는 `Impl`에 둔다.
- DB 접근은 JPA가 아니라 SQL(JdbcClient)이다. `entity`는 `@Entity`가 아니라 테이블 한 행 record다.
- 새로 만들거나 고치는 클래스·메서드는 주석 규칙을 따른다(작성자 길태형, 클래스·메서드·블록 주석).
