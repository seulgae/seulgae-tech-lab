# 개발 환경 런북 (Windows · IntelliJ)

> 갱신: 2026-11-17. 이전 Hyper-V 서버 시절 기록은 삭제했다. 운영 서버 설치·배포·DB 마이그레이션은 [운영 가이드](operations.md)를 따른다.

## 구성

```text
Windows (IntelliJ, 로컬 백엔드·프런트엔드)
  -> SSH 로컬 포워드 127.0.0.1:25432
  -> 홈 서버 PostgreSQL (stlab_dev / stlab_prod)

홈 서버
  -> 연구소 frontend(nginx) + backend(Spring Boot) Compose 프로젝트 seulgae-tech-lab
  -> GitHub Actions: main 병합 시 이미지 게시 후 자동 배포
```

## DB 터널

SSH 접속 정보(별칭·키)는 각자 `~/.ssh/config`에 둔다. 개인키 암호는 Windows ssh-agent에 등록하고 채팅·Git에 공유하지 않는다.

```powershell
# 저장소 루트에서 실행하고 창을 유지한다. 별칭은 본인 ~/.ssh/config의 홈 서버 Host 이름이다.
.\deploy\dev-tunnel.ps1 -SshHost <홈 서버 SSH 별칭>
```

같은 포트(25432)로 이미 터널이 실행 중이면 추가로 실행하지 않는다.

## IntelliJ Database 데이터 소스

| 항목 | 값 |
|---|---|
| Host / Port | 127.0.0.1 / 25432 |
| Database | stlab_dev |
| User | stlab_dev_app |
| Schema | lab |
| URL | `jdbc:postgresql://127.0.0.1:25432/stlab_dev?currentSchema=lab` |

- 외부 SSH 터널을 쓰므로 데이터 소스 안의 SSH 터널 설정은 켜지 않는다.
- 비밀번호는 `%USERPROFILE%\.config\seulgae-tech-lab\dev-app-password`에 있다. 현재 Windows 사용자만 읽을 수 있게 두고, 화면에 출력하지 않는다.
- `stlab_dev_app`은 개발 `lab` 테이블의 조회·쓰기(DML)만 할 수 있다. 테이블 생성·변경(DDL)은 할 수 없다.
- 개발 스키마 변경은 `stlab_dev_migrator`(`dev-migrator-password`)로 Flyway를 실행한다: `. .\deploy\dev-env.ps1 -Migration` 후 `mvn -f backend/pom.xml flyway:migrate flyway:validate`.
- `appuser`는 PostgreSQL **슈퍼유저**(관리 전용)다. IntelliJ 일상 조회에는 쓰지 않는다. 운영 데이터 확인이 꼭 필요할 때만 읽기 전용으로 쓰고, 운영 스키마 변경은 `migrate-prod.py`로만 한다.

### 개발 DB 준비 기록 (2026-11-17)

새 서버에서는 운영 DB만 설정돼 있었고, `stlab_dev`는 빈 DB였다(계정·`lab` 스키마 없음). `deploy/provision-dev-db.sh`를 서버에서 실행해 다음을 만들었다.

- 개발 전용 계정 `stlab_dev_owner`·`stlab_dev_app`·`stlab_dev_migrator`
- 비밀번호(서버에서 생성), `lab` 스키마, 기본 권한

비밀번호 파일 두 개는 이 PC로 복사했다. 이어서 개발 migrator로 Flyway V1~V3를 적용했다. 운영 DB는 바꾸지 않았다. 운영 DB에 PUBLIC CONNECT가 남아 있어 개발 계정이 `stlab_prod`에 접속은 되지만, 운영 테이블 권한은 없다.

## 로컬 백엔드·프런트엔드

- 백엔드는 JDK 17과 Maven이 필요하다. IntelliJ에서 `backend/pom.xml`을 Maven 프로젝트로 열고 `TechLabApplication`을 실행한다.
- PowerShell에서는 개발 DB 환경변수를 불러온 뒤 실행한다. IntelliJ는 이미 실행 중인 프로세스라 PowerShell 환경변수를 상속하지 않으므로, Run Configuration에 같은 값을 넣는다.

```powershell
. .\deploy\dev-env.ps1
mvn -f backend/pom.xml spring-boot:run
```

- 프런트엔드: `cd frontend`, `npm ci`, `npm run dev`. `/api`·`/ws`는 `LAB_DEV_BACKEND_URL`(기본 `http://127.0.0.1:8080`)로 전달된다.
- DB 없이 화면만 확인할 때는 테스트 전용 `LocalLobbyTestApplication`(메모리 저장소)을 8091 포트로 띄운다([multiplayer.md](multiplayer.md)).
- 카카오 로그인 설정은 [kakao-login.md](kakao-login.md)를 따른다. 키가 없으면 로그인은 꺼지고 나머지는 그대로 동작한다.
