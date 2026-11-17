# 슬개기술연구소 물리 홈서버 운영 가이드

## 새 서버와 배포 범위

2026-11-16 기준 대상은 Ubuntu 24.04 물리 서버 `seulgae-home-server` (`192.168.0.191`), 사용자 `seulgae`다. Docker 29.9.3 / Compose v5.7.1, PostgreSQL 18 및 Flyway V1 완료는 사용자가 제공한 현황이다. 이번 코드 작업에서 서버에 접속해 재검증하지 않았다.

- 소스: `/opt/homeserver/apps/seulgae-tech-lab`
- PostgreSQL: `postgres-postgres-1`, 외부 네트워크 `postgres_backend`
- 운영 DB / 스키마 / 실행 계정: `stlab_prod` / `lab` / `stlab_prod_app`
- 별도 migrator: `stlab_prod_migrator`
- Kafka: `kafka-kafka-1`, `homeserver-net`. 현재 연구소 앱은 Kafka에 연결하지 않는다.
- 운영 스크립트는 `seulgae-tech-lab` 프로젝트의 `backend`, `frontend`만 관리한다. PostgreSQL·Kafka·Redis·InvenCore·개발 프록시를 시작·재시작·재생성하지 않는다. 볼륨 삭제, Docker prune, 공유 Compose down도 하지 않는다.
- 웹은 `127.0.0.1:18082`에만 바인딩한다. 백엔드 호스트 포트는 없다.

옛 Hyper-V 주소 `192.168.250.10`, SSH 별칭 `invencore-server`, 공개 호스트 `seulgae-server.tailac4b36.ts.net`은 신규 배포 대상이 아니다. [이전 인프라 조사](infrastructure.md)는 역사 기록이다.

## 자동 배포 비활성화

이전 작업 전 Repository variable `DEPLOY_ENABLED=true`와 옛 `DEPLOY_HOST`가 남아 있음을 확인했다. 사용자 본인 확인 후 `DEPLOY_ENABLED=false` 저장을 확인했다. 이 작업에서는 다시 활성화하지 않는다.

배포 workflow는 동일 저장소 main의 PR 이외 CI 성공과 함께 다음 조건을 모두 요구한다.

- `DEPLOY_ENABLED == 'true'`
- `DEPLOY_TARGET == 'seulgae-home-server'`
- `DEPLOY_HOST`가 옛 서버 호스트와 다름

테스트, 컨테이너 이미지 빌드, main GHCR digest 이미지 및 release manifest 게시는 유지한다. 이미지 게시와 SSH 배포는 별도 작업이다. 변수 변경은 이미 실행 중인 SSH 배포를 취소하지는 않는다.

## 최초 설치 전 준비

아래는 **사용자가 새 서버에서 직접 실행할 명령**이며 에이전트가 실행한 기록이 아니다.

```powershell
ssh seulgae@192.168.0.191
```

접속 후 호스트명과 작업 트리를 확인한다. 대상이 다르거나 기존 수정이 있으면 중단하고 조사한다.

```bash
hostname
cd /opt/homeserver/apps/seulgae-tech-lab
git status --short
git switch main
git pull --ff-only origin main
python3 --version
docker compose version
docker ps --all --format 'table {{.Names}}\t{{.Status}}'
docker network inspect postgres_backend
```

PostgreSQL은 이미 `postgres_backend`에 연결돼 있어야 한다. 네트워크·DB 컨테이너가 없거나 연결이 다르면 중단하며 임의로 생성·연결하지 않는다. Kafka의 `homeserver-net`은 그대로 유지하고 앱을 연결하지 않는다.

| 설정 | 값과 조건 |
| --- | --- |
| `STLAB_SECRETS_DIR` | 선택. 기본 `/opt/homeserver/config/seulgae-tech-lab`. 다른 위치면 절대 경로만 허용 |
| `DB_URL` | Compose 고정: `jdbc:postgresql://postgres-postgres-1:5432/stlab_prod?currentSchema=lab` |
| `DB_USERNAME` | Compose 고정: `stlab_prod_app` |
| `SPRING_CONFIG_IMPORT` | `configtree:/run/secrets/` |
| SQL 초기화 / Flyway 실행 | `SPRING_SQL_INIT_MODE=never`, `SPRING_FLYWAY_ENABLED=false` |
| `prod-app-password` | 기존 파일, 비어 있지 않음. 배포 사용자 및 컨테이너 UID/GID 10001이 읽기 가능 |
| `prod-migrator-password` | 기존 파일, 0600, 배포 사용자 읽기 가능. 앱에는 제공하지 않음 |
| 상태 저장 위치 | 비밀번호 경로 변경과 무관하게 `/opt/homeserver/config/seulgae-tech-lab/ops` 고정 |

DB 자격증명이나 이미지 변수를 셸에 직접 넣지 않는다. 이미지 변수는 검증 manifest로부터 생성한 임시 env 파일에만 설정된다. 비밀번호 파일은 생성·교체하거나 값을 출력하지 않는다.

필요한 경우에만 기존 파일의 소유권·권한을 정리한다. 비밀 디렉터리 0700으로 호스트 접근을 제한하고, app 파일은 bind mount 후 비루트 UID가 읽도록 0444를 사용한다. Compose 파일 secret의 UID/GID 재매핑에 의존하지 않는다. 상위 경로에도 배포 사용자의 접근 권한이 있어야 한다.

```bash
export STLAB_SECRETS_DIR=/opt/homeserver/config/seulgae-tech-lab
sudo chown seulgae:seulgae "$STLAB_SECRETS_DIR"
sudo chmod 0700 "$STLAB_SECRETS_DIR"
sudo chown seulgae:seulgae "$STLAB_SECRETS_DIR/prod-app-password" "$STLAB_SECRETS_DIR/prod-migrator-password"
sudo chmod 0444 "$STLAB_SECRETS_DIR/prod-app-password"
sudo chmod 0600 "$STLAB_SECRETS_DIR/prod-migrator-password"
sudo install -d -m 0700 -o seulgae -g seulgae /opt/homeserver/config/seulgae-tech-lab/ops
```

VM의 `ops/current.json`, `previous.json`, `transaction.json`을 빈 새 서버로 복사하지 않는다. 새 서버에는 복원할 이전 앱이 없다. 이미 상태 파일을 복사했다면 파일 삭제로 우회하지 말고 조사한다.

## 사전 점검과 최초 배포

```bash
cd /opt/homeserver/apps/seulgae-tech-lab
python3 deploy/ops.py check
```

`check`는 Docker·Compose, PostgreSQL 상태와 네트워크, 두 비밀번호 파일과 권한, 해석된 Compose DB 설정, 기존 Flyway V1을 확인한다. SQL은 READ ONLY 트랜잭션으로 실행한다. 성공 이력의 스키마 버전 1 또는 2만 허용하며 실패 이력·미적용·다른 버전이면 중단한다. 배포할 릴리스와 맞는지는 `deploy`가 릴리스의 `db_schema` 범위로 다시 확인한다. 이미지 Pull, 앱 시작, 마이그레이션은 하지 않는다. 자체 ops 디렉터리와 잠금 파일은 만들 수 있다.

병합 후 main CI에서 이미지·manifest 게시가 끝났는지 GitHub Actions에서 사용자가 확인한 다음:

```bash
./deploy.sh
./status.sh
./logs.sh backend
curl --fail --silent --show-error http://127.0.0.1:18082/api/health
```

Windows에서 웹을 확인하려면 별도 PowerShell 창에서 터널을 유지한다.

```powershell
ssh -N -T -o ExitOnForwardFailure=yes -L 5188:127.0.0.1:18082 seulgae@192.168.0.191
# 브라우저에서 http://127.0.0.1:5188 접속. 이미 사용 중인 로컬 5188 포트는 먼저 확인한다.
```

Compose backend의 `LAB_MULTIPLAYER_ALLOWED_ORIGINS`는 다음 3개 Origin으로 고정한다. 새 HTTPS 주소와 SSH 터널의 5188을 허용하고 옛 공개 도메인·와일드카드는 허용하지 않는다. Java 개발용 기본값과 별개로 운영 Compose 설정이 우선한다.

- `https://seulgae-home-server.tailac4b36.ts.net`
- `http://127.0.0.1:5188`
- `http://localhost:5188`

Origin 설정 변경은 아래 업데이트 절차로 새 검증 이미지와 함께 반영한다. `restart.sh`만으로 환경변수 변경을 적용하지 않는다. 호스트 셸에서 export만 하는 것도 컨테이너 설정을 바꾸지 않는다.

새 공개 주소, DNS, Tailscale Serve/Funnel, 라우터는 별도 확인 대상이다. 스크립트는 기존 Funnel을 reset하지 않는다. 개발 DB 프록시의 새 서버 설치는 확인되지 않았으므로 옛 `deploy/dev-tunnel.ps1`을 신규 서버 설정으로 간주하지 않는다.

## 기존 물리 서버 업데이트

GitHub에서 이 변경이 포함된 main CI의 이미지·manifest 게시 완료를 확인한 후 새 서버에서 직접 실행한다. 자동 배포 변수는 계속 false로 유지한다. 작업 트리에 기존 수정이 있으면 먼저 조사하며 덮어쓰지 않는다.

```bash
cd /opt/homeserver/apps/seulgae-tech-lab
git status --short
git switch main && git pull --ff-only origin main
python3 deploy/ops.py check && ./deploy.sh && ./status.sh
./logs.sh backend
```

DB 및 Kafka를 중지하거나 마이그레이션을 재실행하지 않는다. 브라우저는 새 HTTPS 주소에서 새로고침해 로비 연결과 온라인 인원을 확인한다. 이미지 게시 전에 `deploy.sh`를 실행하면 기존 검증 릴리스를 선택할 수 있으므로 새 이미지 게시 여부를 먼저 확인한다.

## 검증 버전 선정과 상태 기록

`deploy.sh`는 성공한 동일 저장소 main의 push/workflow_dispatch CI와 게시 manifest만 선택한다. 저장소·실행 ID·SHA 및 origin/main 조상 여부를 검사한다. GHCR digest만 허용하고 Pull한 이미지의 OCI revision 라벨과 SHA를 대조한다. SHA·태그·Compose 옵션의 직접 전달은 거부한다.

서버 저장소는 `deploy.sh`가 릴리스 커밋으로 맞춘다(PR #32).
- HEAD가 릴리스 SHA와 다르면 추적 파일 변경이 없는지 확인하고 `git checkout --detach <릴리스 SHA>`로 옮긴다. 그런 다음 그 커밋의 `ops.py`로 다시 실행한다.
- 그래서 사전 점검과 `compose.yml`(환경변수·secret)이 배포 이미지와 항상 같은 커밋 기준이다. 서버에서 따로 `git pull`할 필요가 없다. 서버 저장소는 detached HEAD 상태가 정상이다.
- 이미지가 이미 최신이어도 `compose up -d`를 다시 적용해, 설정만 바뀐 서비스는 재생성한다.
- 추적 파일을 서버에서 직접 고쳐 두면 배포가 멈춘다. 고친 내용은 PR로 반영하고 서버 변경은 되돌린다.

- 앱 0개 + 관리 상태 없음: 최초 배포. 가짜 legacy/previous 버전을 생성하지 않는다.
- 앱 일부만 존재하거나 동일 이름의 다른 Compose 컨테이너 존재: 중단한다.
- 기존 앱 2개 + 상태 파일 없음: 기존 legacy 부트스트랩을 유지한다.
- 최초 성공: `current.json` 및 이력만 기록. 두 번째 정상 업데이트부터 `previous.json`이 생긴다.
- 앱 컨테이너 health, HTML, `/api/health`, `/api/research-records?limit=1`과 공유 컨테이너 상태 보존을 검사한다.
- PostgreSQL은 필수다. 옛 InvenCore·Redis·Kafka·PG 프록시는 없으면 건너뛴다. 존재하는 공유 인프라 및 새 `kafka-kafka-1`은 ID·시작 시각·재시작 횟수·실행 상태를 전후 비교한다. 의도적으로 중지된 InvenCore 앱은 중지 상태를 유지하며, 두 앱이 실행 중일 때만 옛 health를 검사한다.

공개 GHCR 패키지 익명 Pull이 기본이다. 권한 오류 시 관리자가 패키지 공개 또는 기존 레지스트리 인증을 확인한다. GitHub API 읽기 권한이나 호출 제한 대응이 필요하면 관리자가 `/opt/homeserver/config/seulgae-tech-lab/github-read-token`에 최소 읽기 권한 토큰을 별도 구성한다. 값을 로그에 출력하지 않는다.

## 업데이트·실패·롤백

| 목적 | 명령 | 동작 |
| --- | --- | --- |
| 사전 점검 | `python3 deploy/ops.py check` | 기존 V1·V2 및 호스트 필수 조건 확인 |
| 최초/이후 배포 | `./deploy.sh` | 검증된 최신 manifest로 앱만 기동·갱신 |
| 시작·중지·재시작 | `./start.sh`, `./stop.sh`, `./restart.sh` | 기록된 연구소 앱만 대상 |
| 상태 | `./status.sh` | SHA·CI 실행 ID·digest·스키마·health 확인 |
| 최근 로그 | `./logs.sh`, `./logs.sh backend`, `./logs.sh frontend` | 최근 100줄 |
| 실시간 로그 | `./logs.sh backend --follow` | Ctrl+C는 로그 조회만 종료 |
| 이전 앱 복원·중단 복구 | `./rollback.sh` | 이전 성공 앱 복원 또는 최초 후보 정리 |

최초 실패에는 복원할 이전 앱이 없다. 후보 이미지 ID와 Compose 소유권을 확인하고 `rm --stop --force backend frontend`로 새 연구소 앱 컨테이너만 정리한다. 공유 네트워크·볼륨·DB·Kafka는 제거하지 않는다. 정리·보존 검사 성공 후 실패 이력을 남기고 다음 `deploy.sh`로 재시도할 수 있다. 정리가 실패하면 transaction을 남기고 중단하며 반복 시도하지 않는다.

이후 업데이트 실패 시 이전 정상 앱을 한 번 복원한다. 복원 실패 시 transaction을 남기고 멈춘다. 성공 시에만 current/previous를 교체한다. 작업 중단으로 transaction이 남으면 내용을 조사하고 명시적으로 `./rollback.sh`를 실행한다. previous가 null인 최초 배포 transaction은 최초 후보 앱만 정리한다. 최초 성공만 있고 이전 성공 버전이 없을 때 일반 rollback은 거부한다.

롤백은 **앱 이미지에만 적용**한다. PostgreSQL 데이터·스키마·Flyway 이력은 되돌리지 않는다. 이전 이미지가 현재 스키마와 호환되지 않으면 거부한다. **완료된 DB에 `provision-db.sh`, Flyway migrate, SQL 초기화를 직접 재실행하지 않는다.** 스키마 변경은 아래 V2 절차처럼 `migrate-prod.py`로만 한다.

### V2 마이그레이션 (회의 안건·수정 키, 2026-11-16)

V2는 `lab.meeting_agendas` 테이블을 만들고, `lab.research_records`에 `edit_token_hash`·`updated_at` 열을 추가한다. 둘 다 추가만 하므로 기존 데이터는 바뀌지 않는다. V2 이후 main 릴리스는 `db_schema` 범위가 **2..2**라서, 운영 DB가 V1인 동안에는 `deploy`가 새 이미지를 거부한다.

1. V2 PR이 main에 병합되고 CI가 새 릴리스(`DB schema compatibility: 2`)를 게시했는지 확인한다.
2. 서버에서 `python3 deploy/ops.py check`로 현재 V1과 필수 조건을 확인한다.
3. `python3 deploy/migrate-prod.py`를 실행한다. 이 스크립트는 다음을 한다.
   - 최신 main 릴리스가 V2를 선언하는지 확인한다.
   - `pg_dump` 백업(`backups/stlab-prod-before-v2-*.dump`)을 만들고 `pg_restore --list`로 검증한다.
   - 그 커밋의 `backend`로 `stlab_prod_migrator` 계정을 써서 Flyway V2를 적용하고 검증한다.
   - 자동 DB 롤백은 없다.
4. `./deploy.sh`로 새 이미지를 배포한다.

V2로 올린 뒤에는 `db_schema`가 1..1인 이전 릴리스로 롤백할 수 없다. 스키마 자체는 이전 이미지와 호환되지만, 이전 릴리스의 선언 범위를 바꾸지 않기 위해서다.

### V3 마이그레이션 (카카오 로그인 회원, 2026-11-17)

V3는 `lab.members`를 만들고, 안건·연구 기록에 `author_id`(작성 회원)를 추가한다. 추가만 하는 변경이다. V3 이후 main 릴리스의 `db_schema`는 **3..3**이므로, 배포 전에 위 V2와 같은 순서로 실행한다.

1. `python3 deploy/ops.py check`
2. `python3 deploy/migrate-prod.py`: V1·V2 → V3, 백업 포함
3. 배포

카카오 키를 설정하기 전까지는 로그인이 꺼진 채(현재와 같은 동작)로 돈다. 키 설정은 [kakao-login.md](kakao-login.md)를 따른다.

### V4 마이그레이션 (아이디어 일지 완료 체크, 2026-11-17) — 확장 먼저, 사용은 나중에

V3까지는 "머지 = 새 스키마가 필요한 코드 배포"라서, 마이그레이션 전에 자동 배포가 먼저 돌아 실패했다. V4부터는 두 단계로 나눈다.

| 순서 | 작업 | 릴리스 `db_schema` | 결과 |
|---|---|---|---|
| 1 | **확장 PR** 머지: V4 SQL(`research_records.done` 열 추가)과 도구만 포함, 앱 코드는 이 열을 쓰지 않음 | **3..4** | 운영 DB가 V3여도 자동 배포 성공 |
| 2 | 서버에서 `python3 deploy/migrate-prod.py` | — | 백업 후 V3 → V4. 실행 중인 앱(3..4)은 영향 없음 |
| 3 | **기능 PR** 머지: 완료 체크 API·화면 | **4..4** | DB가 이미 V4라 자동 배포 성공 |

- `migrate-prod.py`는 최신 main 릴리스와 **지금 실행 중인 릴리스(current.json)** 둘 다 V4를 지원할 때만 실행한다. 1번 배포 전에 실행하면 "deploy the expand release first"로 멈춘다.
- 3번을 2번보다 먼저 머지하면 자동 배포가 스키마 범위 검사에서 멈춘다(DB·앱 변경 없음). 2번 실행 후 `./deploy.sh`를 다시 하면 된다.
- V4는 상수 기본값 열 추가라 기존 행을 다시 쓰지 않는다. V3 앱은 이 열을 무시한다.

### V5 마이그레이션 (공통코드·사무실 업무 게시판, 2026-11-17)

V4와 같은 3단계다. 확장 PR의 릴리스는 `db_schema` **4..5**, 기능 PR은 **5..5**다.

1. 확장 PR 머지(새 테이블 `lab.common_codes`, `lab.work_items`, `lab.inventories`, `lab.coin_events`, `lab.items`와 공통코드 초기 데이터만 추가)
2. 서버에서 `python3 deploy/migrate-prod.py`(백업 후 V4 → V5)
3. 기능 PR(Draft) Ready로 바꾼 뒤 머지

새 테이블만 만드는 변경이라 기존 테이블·데이터는 바뀌지 않는다. 앱 계정 권한은 기본 권한(`ALTER DEFAULT PRIVILEGES`)으로 새 테이블에도 적용된다.

## 운영 상태와 진단

상태 파일은 `/opt/homeserver/config/seulgae-tech-lab/ops`에 기록한다. 새 상태 파일은 기본 0600이다. 변경 작업은 비차단 flock으로 중복 실행을 거부한다.

- `current.json`, `previous.json`: 현재/이전 정상 이미지.
- `transaction.json`: 후보·이전 상태·공유 기준값. 임의 삭제 금지.
- `history.jsonl`: 성공·실패·복원·최초 정리 이력.
- `commands.log`, `commands.previous.log`: 명령 출력. 약 10MB마다 이전 로그 하나로 순환.
- `backups/`: 과거 명시적 마이그레이션 백업 위치. 일반 배포는 백업·복원·마이그레이션을 실행하지 않음.

```bash
tail -n 30 /opt/homeserver/config/seulgae-tech-lab/ops/history.jsonl
tail -n 100 /opt/homeserver/config/seulgae-tech-lab/ops/commands.log
docker inspect postgres-postgres-1 kafka-kafka-1 --format '{{.Name}} {{.Id}} {{.State.StartedAt}} {{.RestartCount}}'
```

## 새 서버 자동 배포 연결은 추후 별도 활성화

| 종류 | 이름 | 내용 |
| --- | --- | --- |
| Repository variable | DEPLOY_TARGET | `seulgae-home-server` |
| Repository variable | DEPLOY_HOST | 새 서버에서 확인한 Tailscale 호스트명/IP. 일반 runner가 내부 IP에 접근할 수 있다고 가정하지 않음 |
| Repository variable | DEPLOY_USER | `seulgae` |
| Repository variable | DEPLOY_ENABLED | 새 서버 접속 검증 완료 전 `false`, 이후에만 `true` |
| Secret | TAILSCALE_AUTHKEY | 새 서버 TCP 22에 접근 가능한 CI 전용 키 |
| Secret | DEPLOY_SSH_PRIVATE_KEY | 새 서버에 등록한 제한된 배포 전용 키 |
| Secret | DEPLOY_SSH_KNOWN_HOSTS | 새 서버에서 직접 확인한 SSH 호스트 공개키 |

전용 공개키에 `restrict,command="/opt/homeserver/apps/seulgae-tech-lab/deploy.sh"` 제한을 적용한다. 옛 서버의 known_hosts·키 등록 기록을 새 서버 확인으로 대신하지 않는다. ssh-keyscan 결과를 무조건 신뢰하거나 tailnet 정책을 전체 허용하지 않는다. Repository 변수와 production Environment 설정의 충돌도 확인한다.

활성화 후 새 main CI 성공 이벤트가 있어야 자동 배포가 시작된다. 과거 성공 이벤트는 재발생하지 않는다. 이번 작업에서는 SSH 접속·수동 배포·운영 DB 변경·자동 배포 활성화·운영 검증을 수행하지 않는다.

참고: [Compose 파일 secret의 bind mount와 권한](https://docs.docker.com/reference/compose-file/services/#secrets), [GitHub Actions 변수](https://docs.github.com/en/actions/concepts/workflows-and-actions/variables).
