# 9단계 — 기존 Ubuntu 서버 재활용

2026-11-15 KST. 이 단계는 인프라와 배포 기반만 구성한다. 연구 기록 API와 게임 확장은 포함하지 않는다.

## 서버 조사 및 기존 서비스

- Ubuntu 24.04 LTS / Hyper-V / CPU 8개 / RAM 7.8GiB / swap 3.8GiB.
- 작업 전 가용 메모리 약 6.3GiB, 루트 디스크 31GiB 중 여유 약 15GiB.
- 최초 이미지 빌드 및 신규 앱 기동 후 가용 메모리 약 5.9GiB, 디스크 여유 약 13GiB. 빌드 캐시와 이미지를 포함한 측정값이다.
- Compose: `invencore-app`, `invencore-infra`, `postgres`.
- InvenCore 프론트엔드 `127.0.0.1:8082`, Redis `127.0.0.1:6379`, Kafka `127.0.0.1:9092`, 기존 PG 프록시 `127.0.0.1:15432`.
- PostgreSQL 18: `postgres-postgres-1`, 기존 볼륨 `postgres_postgres_data`, 외부 포트 공개 없음.
- 기존 DB: `postgres`, `homeserver`, `invencore`(조사 시 약 54MB). 최대 연결 100, 조사 시 InvenCore 연결 10.
- 기존 네트워크: `invencore-app_default`, `invencore-infra-net`, `invencore-test-net`, `postgres_backend`.
- InvenCore 실제 상태 확인: `http://127.0.0.1:8082/api/health`, JSON `status=UP`. `/actuator/health`는 프론트엔드 SPA로 응답할 수 있어 정상 여부 판단에 사용하지 않는다.

## 격리 구조

```text
Windows IntelliJ / local backend
  -> SSH local forward 127.0.0.1:25432
  -> Ubuntu 127.0.0.1:25432 -> dedicated socat -> PostgreSQL stlab_dev

Ubuntu 127.0.0.1:18082
  -> tech-lab frontend (nginx, React + Phaser)
  -> internal app network -> tech-lab backend (Spring Boot, Java 17)
  -> existing postgres_backend -> PostgreSQL stlab_prod
```

- 신규 소스: `/opt/homeserver/apps/seulgae-tech-lab`.
- 앱 Compose 프로젝트: `seulgae-tech-lab`. 네트워크: `seulgae-tech-lab_edge`, `seulgae-tech-lab_app`(internal).
- 개발 접속 Compose 프로젝트: `seulgae-tech-lab-dev-access`.
- 신규 백엔드와 개발 프록시만 기존 `postgres_backend`에 참여한다. 기존 PG 컨테이너의 네트워크 연결은 변경하지 않았다.
- 백엔드 호스트 포트 없음. 신규 웹 `127.0.0.1:18082`와 개발 DB 프록시 `127.0.0.1:25432`만 바인딩한다.
- 런타임 메모리 상한: 프론트엔드 128MiB, 백엔드 512MiB, 프록시 32MiB. 백엔드 Hikari 최대 연결 5.
- 기존 서비스의 Compose, 이미지, 컨테이너, 볼륨, 배포 스크립트는 변경하지 않는다.
- DB 인스턴스와 호스트를 공유하므로 CPU/디스크/DB 장애까지 격리되는 구성은 아니다. 새 계정의 기존 DB `CONNECT` 권한은 기존 `PUBLIC` ACL을 따를 수 있지만, InvenCore 애플리케이션 테이블의 읽기·쓰기 권한은 없음을 검증했다. 기존 DB의 ACL은 변경하지 않았다.

## DB와 비밀정보

| 목적 | DB | 실행 계정 | 마이그레이션 계정 | DB 소유자(NOLOGIN) |
|---|---|---|---|---|
| 개발 | stlab_dev | stlab_dev_app | stlab_dev_migrator | stlab_dev_owner |
| 운영 | stlab_prod | stlab_prod_app | stlab_prod_migrator | stlab_prod_owner |

- 각 DB는 PUBLIC 권한을 제거하고 해당 환경의 두 로그인 계정에 CONNECT만 부여한다. 반대 환경의 DB 연결은 차단한다.
- `lab` 스키마는 해당 migrator가 소유한다. app은 USAGE와 migrator가 생성한 테이블의 DML, 시퀀스 사용 권한만 갖는다. 앱 계정은 스키마·테이블 생성, DB·계정 생성, 슈퍼유저 권한이 없다.
- DB 연결 한도 각 15, 앱 계정 각 8, migrator 각 2.
- 초기화 SQL 자동 실행은 꺼져 있다. 다음 단계의 Flyway는 반드시 해당 migrator로 실행한다. 운영 migrator를 일반 앱 실행에 사용하지 않는다.
- 서버 비밀번호: `/opt/homeserver/config/seulgae-tech-lab/{dev,prod}-{app,migrator}-password`.
- 상위 비밀 디렉터리 권한 0700. 파일은 기본 0600. 운영 앱 파일만 0444로 하여 Compose bind mount를 통해 컨테이너의 비루트 UID가 읽게 한다. 호스트의 다른 일반 사용자는 상위 디렉터리로 접근할 수 없다.
- 운영 앱에는 운영 app 비밀번호 파일 하나만 `/run/secrets/DB_PASSWORD`에 제공한다. 비밀번호를 Compose 환경변수, 이미지, Git에 기록하지 않는다. Compose secrets는 호스트 파일 bind mount이므로 암호화 저장소는 아니다.
- `provision-db.sh`는 최초 1회용이며 같은 이름의 DB/계정/비밀번호가 있으면 중단한다. 재실행하거나 DB를 삭제해 복구하지 말고 상태를 먼저 조사한다.
- `verify-db.sh`는 개발 DB의 DDL/DML 검증을 트랜잭션으로 롤백하고, 환경 간 접속 권한과 InvenCore 테이블 ACL만 확인한다. 운영 테이블에 실험 데이터를 쓰지 않는다.

## Windows와 IntelliJ

SSH 별칭 `invencore-server`를 사용한다. 개인키 암호는 Windows ssh-agent에 등록하고 채팅·Git에 공유하지 않는다.

```powershell
# 저장소 루트에서 실행하고 창을 유지한다.
.\deploy\dev-tunnel.ps1
```

터널은 로컬 DB `127.0.0.1:25432`와 배포된 웹 `http://127.0.0.1:18082`를 제공한다. 같은 포트로 이미 터널이 실행 중이면 추가 실행하지 않는다.

IntelliJ Database의 PostgreSQL 데이터 소스:

| 항목 | 값 |
|---|---|
| Host / Port | 127.0.0.1 / 25432 |
| Database | stlab_dev |
| User | stlab_dev_app |
| Schema | lab |
| URL | jdbc:postgresql://127.0.0.1:25432/stlab_dev?currentSchema=lab |

외부 SSH 터널을 쓰므로 데이터 소스 내부 SSH 터널은 켜지 않는다. 비밀번호는 `%USERPROFILE%\.config\seulgae-tech-lab\dev-app-password`에 저장했으며 현재 Windows 사용자에게만 디렉터리 접근 권한을 부여했다. 필요한 경우 PowerShell에서 다음 명령으로 복사하고 IntelliJ 비밀번호 칸에 붙여넣는다. 콘솔에 비밀번호를 출력하지 않는다.

```powershell
Get-Content "$env:USERPROFILE\.config\seulgae-tech-lab\dev-app-password" -Raw | Set-Clipboard
# 붙여넣은 뒤 클립보드 비우기
Set-Clipboard -Value ''
```

스키마 마이그레이션은 별도 데이터 소스 `stlab_dev_migrator`와 `dev-migrator-password`를 사용한다. 운영 자격증명은 Windows로 복사하지 않았다.

로컬 백엔드는 JDK 17과 Maven이 필요하다. IntelliJ에서 `backend/pom.xml`을 Maven 프로젝트로 열고 `TechLabApplication`을 실행한다. 환경변수 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 위 개발 값으로 지정한다. `.idea` 설정을 Git에 올리지 않는다. PowerShell에서 실행할 때:

```powershell
. .\deploy\dev-env.ps1
mvn -f backend/pom.xml spring-boot:run
```

IntelliJ는 이미 실행 중인 프로세스이므로 PowerShell 환경변수를 자동으로 상속하지 않는다. Run Configuration에 값을 지정하거나, 환경을 로드한 창에서 IDE를 새로 시작한다. 현재 PC에서는 SSH 터널을 통한 실제 PostgreSQL 로그인·개발 migrator DDL·운영 DB 접속 거부를 검증했다. IntelliJ GUI 연결 및 로컬 JDK/Maven 실행은 별도 확인이 필요하다.

프론트엔드 로컬 실행: `cd frontend`, `npm ci`, `npm run dev`. 현재 연구 기록 API는 없으며 백엔드는 DB 연결을 검사하는 상태 확인 기반만 제공한다.

## 배포, CI와 HTTPS

- `compose.yml`은 이 프로젝트의 프론트엔드와 백엔드만 관리한다. 다른 프로젝트의 `down`, `restart`, `prune`, 볼륨 삭제 명령을 사용하지 않는다.
- 이미지에 커밋 SHA 태그를 사용한다. 이전 성공 태그는 `/opt/homeserver/config/seulgae-tech-lab/deployed-sha`에 기록한다.
- `deploy.sh`는 Git 작업 트리가 깨끗한지, 요청 SHA가 원격 main에 포함되는지 확인하고 단일 배포 잠금을 획득한다. 순차 이미지 빌드 후 신규 앱만 기동하고 전후 기존 서비스 상태를 검증한다. 신규 릴리스 기동/HTTP 검증 실패 시 이전 성공 이미지 태그로 복원한다. DB 마이그레이션 자동 롤백은 수행하지 않는다.

```bash
bash /opt/homeserver/apps/seulgae-tech-lab/deploy/deploy.sh FULL_MAIN_COMMIT_SHA
```

GitHub Actions는 main/codex 브랜치 및 PR에서 프론트엔드 테스트·린트·빌드, 백엔드 Maven verify, 두 Docker 이미지 빌드를 수행한다. 자동 배포 job은 기본 비활성이다. 활성화에는 다음 GitHub 설정이 필요하다.

| 종류 | 이름 | 내용 |
|---|---|---|
| Secret | TAILSCALE_AUTHKEY | CI용 재사용 가능한 ephemeral auth key. CI 노드에서 대상 서버 TCP 22만 허용하는 tailnet ACL 구성 |
| Secret | DEPLOY_SSH_PRIVATE_KEY | 전용 배포키. 기존 개인용 homeserver 키를 재사용하지 않는다 |
| Secret | DEPLOY_SSH_KNOWN_HOSTS | 검증한 서버 SSH 호스트 공개키. 대상 호스트명과 일치해야 한다 |
| Variable | DEPLOY_HOST | seulgae-server.tailac4b36.ts.net 또는 해당 Tailscale IP |
| Variable | DEPLOY_USER | 전용 배포 권한을 구성한 계정 |
| Variable | DEPLOY_ENABLED | 전용 자격증명과 권한 검증이 끝난 뒤 true |

전용 배포키의 서버 측 권한은 이 프로젝트 배포 명령으로 제한하는 것을 권장한다. Docker 그룹은 관리자 수준 권한이므로 배포계정에 무분별하게 부여하지 않는다. 현재 전용 CI 키·tailnet 자격증명이 없어 자동 배포 활성화 및 GitHub에서 서버까지의 배포 검증은 완료하지 않았다. 확인되지 않은 자격증명이나 기존 InvenCore 배포 경로를 재사용하지 않는다.

HTTPS 공개 설계: 기존 Funnel의 443 → `127.0.0.1:8082`를 유지하고, 새 8443 → `127.0.0.1:18082`를 추가한다. 현재 새 사이트를 인터넷에 공개하지 않았다. 공개 시 운영자가 아래 명령을 실행하고 기존 443 매핑이 유지되는지 전후 확인한다.

```bash
tailscale funnel status
sudo tailscale funnel --bg --https=8443 http://127.0.0.1:18082
tailscale funnel status
```

예정 주소: `https://seulgae-server.tailac4b36.ts.net:8443`. PostgreSQL은 Funnel로 공개하지 않는다. `tailscale funnel reset`은 기존 서비스를 제거하므로 사용하지 않는다.

참고: [Funnel 포트 제약](https://tailscale.com/docs/features/tailscale-funnel), [Tailscale GitHub Action](https://github.com/tailscale/github-action), [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [PostgreSQL 권한](https://www.postgresql.org/docs/current/ddl-priv.html).

## 검증과 다음 단계

- 기존 컨테이너 6개의 ID·시작 시각·재시작 횟수와 읽을 수 있는 최상위 Compose/.env 파일 SHA-256을 비교한다. 권한이 없는 과거 백업 파일은 제외한다.
- InvenCore 프론트엔드·백엔드, PostgreSQL, Kafka, Redis health가 healthy이고 실제 `/api/health` 응답이 UP인지 확인한다.
- 새 컨테이너 health, `/api/health` 및 실제 `stlab_prod_app` 연결을 확인한다.
- 개발 계정의 운영 DB 접속 거부, runtime DDL 불가, migration 기본 DML 권한, 기존 InvenCore 테이블 접근 불가를 검증한다.
- 다음 단계: IntelliJ GUI 접속 확인, 연구 기록 스키마와 Flyway 마이그레이션 설계, 연구 기록 API 구현, React 패널 연동. 게임 기능 확장은 이후 별도 진행한다.
