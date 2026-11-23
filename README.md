# 슬개기술연구소 (seulgae-tech-lab)

브라우저에서 돌아다니는 2D 픽셀 연구소입니다. 로비·개발 연구실·사무실·회의실·바깥 초원을 걸어 다니며 연구 아이디어를 남기고, 사무실 게시판에서 일하고, 낚시와 오락실을 즐깁니다. **회의실에서만** 다른 사람과 실시간으로 만나고 채팅합니다.

- 프런트엔드: React + Phaser 게임 화면, 방마다 다른 테마·연출·소리(모두 코드로 합성)
- 백엔드: Spring Boot REST API + 회의실 전용 WebSocket 멀티플레이
- 데이터: PostgreSQL + Flyway 마이그레이션

이 문서는 **저장소를 clone해서 개발을 시작하는 방법**을 다룹니다. 운영 서버 배포는 저장소 관리자만 합니다([운영 가이드](docs/operations.md)).

---

## 기술 스택

| 영역 | 기술 | 버전 |
|---|---|---|
| 게임·화면 | [React](https://react.dev), [Phaser](https://phaser.io) (Arcade Physics) | React 19, Phaser 3.90 |
| 프런트 빌드 | [Vite](https://vite.dev), TypeScript | Vite 8, TypeScript 7 |
| 프런트 테스트·린트 | Node 내장 테스트(`node --test`), [oxlint](https://oxc.rs) | Node 24 |
| 백엔드 | Java, [Spring Boot](https://spring.io/projects/spring-boot) (Web MVC, WebSocket, JdbcClient), Jackson 3 | Java 17, Spring Boot 4.1 |
| 백엔드 빌드·테스트 | Maven, JUnit 5 | Maven 3.8+ |
| DB | [PostgreSQL](https://www.postgresql.org), [Flyway](https://flywaydb.org) | PostgreSQL 18 |
| 로그인 | 카카오 로그인(OAuth), 서명된 HttpOnly 쿠키 | 선택 사항 |
| 배포 | Docker Compose, GitHub Actions(CI·이미지 빌드), GHCR, nginx | — |

---

## 폴더 구조

```
seulgae-tech-lab/
├─ frontend/            React + Phaser 게임 (Vite)
│  ├─ src/game/         장면(Scene), 방 연출(RoomFx), 픽셀 텍스처, 플레이어
│  ├─ src/features/     화면 기능(게시판·가방·방명록·쿼리 콘솔·멀티플레이 클라이언트 등)
│  ├─ src/audio/        음악·효과음 합성(오디오 파일 없음)
│  └─ tests/            프런트 테스트(*.test.mjs)
├─ backend/             Spring Boot API
│  ├─ src/main/java/kr/seulgae/techlab/   기능별 → 계층별(controller·dto·entity·repository·service) 패키지, docs/backend-structure.md
│  ├─ src/main/resources/db/migration/    Flyway 마이그레이션(V1~)
│  ├─ src/test/                           JUnit 테스트, DB 없는 로컬 실행용 앱
│  └─ tests/research-api.mjs              실제 DB에 대고 돌리는 API 계약 테스트(CI)
├─ shared/lobby-world.json   방·문·가구·상호작용 지도(프런트·백엔드가 함께 읽음)
├─ deploy/              배포·마이그레이션 스크립트와 테스트(Python)
├─ docs/                설계 문서와 개발 로그(dev-log)
└─ compose.yml          운영 Docker Compose
```

`shared/lobby-world.json`은 프런트(그리기·충돌·상호작용)와 백엔드(회의실 이동 검증·의자)가 **같은 파일**을 씁니다. 방이나 가구를 바꿀 때는 이 파일부터 고칩니다.

---

## 준비물

| 도구 | 버전 | 용도 |
|---|---|---|
| JDK | 17 | 백엔드 |
| Maven | 3.8 이상 | 백엔드 빌드·테스트 (`mvn`이 PATH에 있어야 합니다) |
| Node.js | 24 | 프런트엔드 |
| Docker | 최신 | (선택) 로컬 PostgreSQL |
| Python | 3.10 이상 | (선택) 배포 스크립트 테스트, Linux/macOS |

```bash
git clone https://github.com/seulgae/seulgae-tech-lab.git
```

```bash
cd seulgae-tech-lab
```

---

## 빠른 시작 A — DB 없이 화면 띄우기 (가장 쉬움)

게임 화면과 멀티플레이, 방명록·업무 게시판·가방처럼 **메모리 저장소로 대신할 수 있는 기능**을 DB 없이 확인합니다. 테스트용 앱(`LocalLobbyTestApplication`)이 저장소를 메모리 구현으로 바꿔 띄웁니다. 카카오 로그인은 꺼져 있어 누구나 비회원으로 씁니다.

**1) 백엔드 (포트 8091)**

```bash
mvn -f backend/pom.xml -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=target/test-classpath.txt
```

macOS·Linux:

```bash
cd backend && java -cp "target/test-classes:target/classes:$(cat target/test-classpath.txt)" kr.seulgae.techlab.multiplayer.lobby.LocalLobbyTestApplication --server.port=8091
```

Windows PowerShell:

```powershell
cd backend; java -cp ("target\test-classes;target\classes;" + (Get-Content target\test-classpath.txt -Raw).Trim()) kr.seulgae.techlab.multiplayer.lobby.LocalLobbyTestApplication --server.port=8091
```

**2) 프런트엔드 (포트 5173)** — 다른 터미널에서

```bash
cd frontend && npm ci
```

macOS·Linux:

```bash
LAB_DEV_BACKEND_URL=http://127.0.0.1:8091 npm run dev
```

Windows PowerShell:

```powershell
$env:LAB_DEV_BACKEND_URL="http://127.0.0.1:8091"; npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다. 방향키·WASD로 움직이고 E로 문과 장비를 씁니다. 회의실에 들어가면 서버에 연결되어 다른 창과 함께 움직이고 채팅할 수 있습니다.

> DB 없는 실행에는 회원 기능(가방 동전·HP), 관리자 쿼리 콘솔이 들어 있지 않습니다. 이 기능은 빠른 시작 B로 확인합니다.

---

## 빠른 시작 B — 로컬 PostgreSQL로 전체 실행

CI와 같은 방법으로 일회용 PostgreSQL을 만들고 마이그레이션한 뒤 백엔드를 띄웁니다. 아래 비밀번호는 **로컬·CI 전용** 값입니다(`backend/src/test/resources/bootstrap-ci.sql`).

**1) PostgreSQL 18 띄우기**

```bash
docker run -d --name stlab-pg -e POSTGRES_DB=research_ci -e POSTGRES_PASSWORD=local-only -p 127.0.0.1:5432:5432 postgres:18
```

**2) 역할(마이그레이션용·앱용)과 `lab` 스키마 만들기**

```bash
docker exec -i stlab-pg psql -U postgres -d research_ci -v ON_ERROR_STOP=1 < backend/src/test/resources/bootstrap-ci.sql
```

**3) 마이그레이션(Flyway)** — 마이그레이션 계정으로 실행합니다.

```bash
DB_URL="jdbc:postgresql://127.0.0.1:5432/research_ci?currentSchema=lab" DB_USERNAME=test_migrator DB_PASSWORD=ci-migrator-only mvn -f backend/pom.xml flyway:migrate flyway:validate
```

**4) 백엔드 빌드·실행 (포트 8080)** — 앱 계정으로 실행합니다(테이블 변경 권한 없음).

```bash
mvn -f backend/pom.xml -q -DskipTests package
```

```bash
DB_URL="jdbc:postgresql://127.0.0.1:5432/research_ci?currentSchema=lab" DB_USERNAME=test_app DB_PASSWORD=ci-app-only LAB_RESEARCH_WRITE_ENABLED=true java -jar backend/target/tech-lab-0.0.1-SNAPSHOT.jar
```

Windows PowerShell은 환경 변수를 먼저 정한 뒤 같은 명령을 실행합니다(예: `$env:DB_USERNAME="test_app"`).

**5) 프런트엔드**

```bash
cd frontend && npm ci && npm run dev
```

백엔드가 기본 포트 8080이라 `LAB_DEV_BACKEND_URL`은 필요 없습니다. 정리할 때는 `docker rm -f stlab-pg`.

> 카카오 로그인과 관리자 쿼리 콘솔까지 시험하려면 [카카오 로그인 설정](docs/kakao-login.md)의 키와 `LAB_AUTH_SESSION_SECRET`, http 로컬이면 `LAB_AUTH_COOKIE_SECURE=false`를 함께 넣습니다. 관리자실은 회원 등급 3만 들어갑니다. 로컬 DB에서 `UPDATE lab.members SET level = 3 WHERE id = '내 회원 id';`로 올립니다.

---

## 테스트와 검사

PR을 올리기 전에 CI와 같은 검사를 돌립니다.

```bash
cd frontend && npm test && npm run lint && npm run build
```

```bash
mvn -f backend/pom.xml verify
```

```bash
python3 -m unittest discover -s deploy -p 'test_*.py'
```

- 프런트 테스트는 브라우저 없이 Node에서 돕니다(게임 장면은 가짜 Phaser 객체로 시험).
- 백엔드 단위 테스트는 DB 없이 돕니다. 실제 DB 동작은 CI가 일회용 PostgreSQL에 마이그레이션하고 `backend/tests/research-api.mjs`로 확인합니다.
- 배포 테스트는 리눅스 전용 모듈(`fcntl`)을 써서 Linux/macOS에서 돌립니다.

---

## 주요 설정 (환경 변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://127.0.0.1:25432/stlab_dev?currentSchema=lab` | DB 주소 |
| `DB_USERNAME` / `DB_PASSWORD` | `stlab_dev_app` / 없음 | 앱 DB 계정 |
| `LAB_AUTH_KAKAO_CLIENT_ID`, `LAB_AUTH_KAKAO_CLIENT_SECRET`, `LAB_AUTH_KAKAO_REDIRECT_URI`, `LAB_AUTH_SESSION_SECRET` | 없음 | 카카오 로그인. 없으면 로그인이 꺼지고 비회원으로 동작 |
| `LAB_AUTH_COOKIE_SECURE` | `true` | http 로컬 시험에서만 `false` |
| `LAB_MULTIPLAYER_ALLOWED_ORIGINS` | localhost 5173·5188 등 | WebSocket을 허용할 Origin |
| `LAB_MULTIPLAYER_SINGLE_CONNECTION_PER_ADDRESS` | `false` | `true`면 한 IP에 회의실 연결 하나 |
| `LAB_WRITE_CLIENT_CAPACITY` | `5` | 한 사람의 짧은 시간 글쓰기 허용량 |
| `LAB_DEV_BACKEND_URL` (프런트) | `http://127.0.0.1:8080` | Vite 개발 서버가 `/api`·`/ws`를 넘길 백엔드 |

비밀 값(DB 비밀번호, 카카오 Client Secret, 세션 비밀값)은 저장소에 커밋하지 않습니다. 운영은 Docker secrets로 넣습니다.

---

## 개발 규칙

**브랜치와 PR**
- `main`에 직접 커밋하지 않습니다. 기능 브랜치(`feat/…`, `fix/…`, `chore/…`) → PR → CI 통과 → 머지.
- PR은 항상 `main`을 대상으로 합니다(PR 위에 PR을 쌓지 않습니다).
- `main`에 머지되면 GitHub Actions가 이미지를 만들어 운영 서버에 자동 배포합니다.

**커밋 메시지**
- 영어 타입 접두사 + 한국어 내용: `feat: 로비 방명록 추가`, `fix: 띄어쓰기가 안 되던 버그 수정`, `chore: …`, `test: …`, `docs: …`

**DB 스키마 변경 (Expand → Migrate → Use)**

운영 DB는 배포가 자동으로 마이그레이션하지 않습니다. 스키마를 바꿀 때는 세 단계로 나눕니다.

1. **확장 PR**: 새 `V{n}__*.sql`과 도구 버전만 올립니다. CI 릴리스 `db_schema`를 `n-1..n`으로 해서 옛 스키마에서도 배포되게 합니다.
2. **마이그레이션**: 관리자가 운영 서버에서 `python3 deploy/migrate-prod.py`(백업 후 적용)를 실행합니다.
3. **사용 PR**: 새 스키마를 쓰는 코드(`db_schema` `n..n`)를 머지합니다.

자세한 절차는 [운영 가이드](docs/operations.md)에 있습니다.

**기록**
- 기능 PR마다 [개발 로그](docs/dev-log/README.md)에 날짜별 항목(구현·주요 소스·기술 포인트·트러블슈팅)을 남깁니다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [infrastructure.md](docs/infrastructure.md) | 서버 구성, 개발 DB 접속(SSH 터널), IntelliJ 설정 |
| [operations.md](docs/operations.md) | 배포·롤백·마이그레이션·관리자 쿼리 콘솔 운영 |
| [rooms.md](docs/rooms.md) | 방 이동과 회의실 전용 멀티플레이 |
| [multiplayer.md](docs/multiplayer.md), [movement-stability.md](docs/movement-stability.md), [network-latency.md](docs/network-latency.md) | 이동 예측·보정, 지연 진단 |
| [room-interactions.md](docs/room-interactions.md), [room-atmosphere.md](docs/room-atmosphere.md), [room-boards-and-props.md](docs/room-boards-and-props.md) | 방별 상호작용·테마·소품 |
| [chat.md](docs/chat.md), [server-capacity.md](docs/server-capacity.md) | 채팅, 서버실 랙 용량 조사 |
| [kakao-login.md](docs/kakao-login.md) | 카카오 로그인 설정 |
| [sound.md](docs/sound.md), [pixel-lobby.md](docs/pixel-lobby.md) | 소리 합성, 픽셀 아트 |
| [dev-log](docs/dev-log/README.md) | 날짜별 개발 로그 |
