# 슬개기술연구소 서버 운영 가이드

서버는 Ubuntu 24.04 LTS, 애플리케이션 경로는 `/opt/homeserver/apps/seulgae-tech-lab`이다. 여기의 모든 명령은 연구소의 `backend`, `frontend`만 대상으로 한다. InvenCore, PostgreSQL, Redis, Kafka, 개발 DB 프록시를 시작·중지·재시작하지 않는다.

## SSH 접속과 기본 확인

Windows PowerShell:

```powershell
ssh invencore-server
```

현재 SSH 설정의 별칭은 `invencore-server`, 대상은 `seulgae@192.168.250.10`, 개인키 파일은 `$env:USERPROFILE\.ssh\homeserver_ed25519`이다. 개인키 내용이나 암호를 문서·Git·채팅에 복사하지 않는다. 키 암호가 필요한 경우 Windows ssh-agent에 직접 등록한다.

```powershell
ssh-add "$env:USERPROFILE\.ssh\homeserver_ed25519"
```

서버 접속 후:

```bash
hostname
uptime
free -h
df -h /
docker compose ls
cd /opt/homeserver/apps/seulgae-tech-lab
./status.sh
```

## 경로

| 대상 | 실제 경로 |
| --- | --- |
| 소스·운영 명령 | `/opt/homeserver/apps/seulgae-tech-lab` |
| 기본 Compose | `/opt/homeserver/apps/seulgae-tech-lab/compose.yml` |
| digest 이미지 오버라이드 | `/opt/homeserver/apps/seulgae-tech-lab/deploy/compose.release.yml` |
| 공통 운영 구현 | `/opt/homeserver/apps/seulgae-tech-lab/deploy/ops.py` |
| 비밀 파일 | `/opt/homeserver/config/seulgae-tech-lab` |
| 현재·이전 정상 버전 | `/opt/homeserver/config/seulgae-tech-lab/ops/current.json`, `previous.json` |
| 진행 중 작업 복구 기록 | `/opt/homeserver/config/seulgae-tech-lab/ops/transaction.json` |
| 배포·운영 이력 | `/opt/homeserver/config/seulgae-tech-lab/ops/history.jsonl` |
| 명령 출력·실패 원인 | `/opt/homeserver/config/seulgae-tech-lab/ops/commands.log`, `commands.previous.log` |
| 운영 DB 사전 백업 | `/opt/homeserver/config/seulgae-tech-lab/ops/backups` |

운영 상태 디렉터리는 0700, 새 상태 파일은 0600으로 생성한다. 명령 출력 로그는 약 10MB를 넘으면 한 개의 이전 로그로 교체한다. Docker 애플리케이션 로그는 기존 json-file 크기 제한을 유지한다. 이미지·DB 볼륨을 자동 정리하지 않는다.

## 복사해서 실행할 운영 명령

아래 명령의 실행 위치는 모두 `/opt/homeserver/apps/seulgae-tech-lab`이다.

| 목적 | 명령 | 정상 결과 | 실패 시 조치 |
| --- | --- | --- | --- |
| 최신 검증 버전 배포 | `./deploy.sh` | SUCCESS deploy 또는 이미 최신이라는 안내 | commands.log, history.jsonl, ./logs.sh 확인 |
| 현재 버전 시작 | `./start.sh` | 두 앱 컨테이너 healthy, SUCCESS start | 상태·로그와 DB 연결 확인 |
| 연구소 앱만 중지 | `./stop.sh` | 두 앱 컨테이너 중지, SUCCESS stop | ./status.sh 및 Docker 데몬 확인 |
| 연구소 앱 재시작 | `./restart.sh` | 재시작 후 health 통과 | ./logs.sh backend 확인, 반복 재시작 금지 |
| 상태 확인 | `./status.sh` | SHA·CI 실행 ID·digest·스키마·컨테이너 상태와 API 결과 | stopped 상태면 오류가 정상일 수 있음, ./start.sh |
| 최근 앱 로그 | `./logs.sh` | 두 앱 최근 100줄 | Docker 접근 권한 확인 |
| 백엔드 로그 | `./logs.sh backend` | backend 최근 100줄 | 데이터베이스 연결·스키마 확인 |
| 프론트엔드 로그 | `./logs.sh frontend` | frontend 최근 100줄 | nginx 및 backend 상태 확인 |
| 실시간 로그 | `./logs.sh backend --follow` | 로그 스트리밍, Ctrl+C로 조회만 종료 | 앱을 중지하는 명령이 아님 |
| 이전 정상 앱 복원 | `./rollback.sh` | 이전 이미지로 기동·검증, SUCCESS rollback | transaction.json과 로그 조사, 무한 재시도 금지 |

모든 명령은 공유 운영 잠금을 사용하며 중복 변경 작업을 거부한다. `status`와 `logs`는 조회용이다. SHA, 이미지 태그, Compose 옵션을 직접 인자로 전달하지 않는다.

`restart.sh`는 컨테이너 재시작이며 Ubuntu 재부팅이 아니다. OS 재부팅은 공유 서비스를 모두 중단시키므로 이 스크립트에 포함하지 않는다. OS 재부팅이 별도로 승인된 유지보수일 때만 `sudo reboot`를 사용하고 복귀 후 SSH, `docker compose ls`, 연구소 `./status.sh` 및 InvenCore 상태를 확인한다.

## 검증 버전 선정과 배포

1. GitHub의 `ci.yml` 실행 중 main의 성공 완료된 push 또는 workflow_dispatch 실행만 조회한다.
2. 해당 실행의 `deploy-run-실행ID` GitHub Release에 있는 `release.json`을 읽는다. 이전 CI에 manifest가 없으면 건너뛴다. 조회 범위는 최근 성공 실행 최대 50개이다.
3. 저장소, 실행 ID와 head SHA를 대조하고 원격 main의 조상인 커밋인지 확인한다. 실패·진행 중·PR·작업 브랜치는 대상이 아니다.
4. manifest의 backend/frontend `ghcr.io/...@sha256:...` 형식을 검사한다. latest 태그나 다른 레지스트리를 허용하지 않는다.
5. 현재 DB 스키마가 해당 앱의 호환 범위인지 확인한다. 범위 밖이면 컨테이너를 건드리기 전에 중단한다.
6. 두 digest 이미지를 Pull하고 이미지의 OCI revision 라벨이 검증 SHA와 같은지 확인한다. 이미지가 없거나 접근할 수 없으면 중단한다.
7. 이전 정상 버전과 후보를 transaction.json에 기록한 뒤 연구소 앱만 갱신한다.
8. 컨테이너 health, 웹 HTML, `/api/health`, `/api/research-records?limit=1`을 확인한다. 기존 공유 컨테이너 ID·시작 시각·재시작 횟수·실행 상태를 전후 대조한다. 사용자가 중지한 InvenCore 앱은 중지 상태를 보존하며, 실행 중일 때만 InvenCore health도 확인한다.
9. 성공하면 current/previous 및 이력을 저장한다. 실패하면 이전 앱을 한 번 복원한다. 복원에도 실패하면 원인을 기록하고 멈춘다.

초기 인프라 버전은 첫 실행 때 현재 컨테이너의 이미지 ID로 기록한다. 그 버전에는 연구 기록 API가 없으므로 해당 초기 버전의 복원 검증은 HTML과 health에 한정된다. 초기 버전의 DB 호환 범위는 기존 상태를 확인한 0..1로만 기록한다.

현재 구성은 공개 GHCR 이미지를 사용한다. 최초 게시된 패키지는 GitHub에서 공개로 바꿔야 익명 Pull이 된다. 공개 설정이 끝나기 전 배포는 인증 오류로 중단될 수 있으며 레지스트리 인증을 임의로 우회하지 않는다. 공개 API 호출 제한에 걸리면 기다리거나 관리자가 `github-read-token` 파일에 이 저장소 Actions 조회용 최소 권한 토큰을 별도로 구성한다. 토큰 값은 로그에 출력하지 않는다.

## DB 마이그레이션과 복원 구분

현재 연구 기록 앱은 스키마 1이 필요하다. 운영 DB는 초기 인프라 단계에서 빈 lab 스키마로 준비돼 있었다. 최초 V1 적용은 일반 배포와 별도로 다음 명령을 사용한다.

```bash
cd /opt/homeserver/apps/seulgae-tech-lab
python3 deploy/migrate-prod.py
```

이 명령은 최신 성공 main manifest를 확인하고, 운영 DB를 pg_dump로 백업한 뒤 pg_restore --list로 백업을 읽을 수 있는지 확인한다. 검증 커밋의 마이그레이션 소스를 추출해 전용 운영 migrator로 Flyway target=1 migrate/validate만 수행한다. 운영 계정의 비밀번호는 서버 비밀 파일에서 읽는다. 스키마가 이미 1이면 변경하지 않는다. V2 이상 적용이나 DB 복원을 자동 처리하지 않는다.

`rollback.sh`는 **앱 이미지만 복원**한다. PostgreSQL 데이터, Flyway 이력, 스키마를 되돌리지 않는다. 현재 스키마가 이전 이미지의 호환 범위를 벗어나면 롤백을 거부한다. DB 복원이 필요하면 백업을 확인하고 별도 승인·절차를 진행한다.

작업 도중 프로세스가 끊겨 transaction.json이 남으면 다른 변경 명령은 중단된다. 내용을 확인한 뒤 명시적으로 `./rollback.sh`를 실행하면 기록된 이전 앱으로 복구를 한 번 시도한다. 상태 파일을 임의 삭제하거나 DB를 초기화해 해결하지 않는다.

## 장애 대응과 공유 인프라 조회

```bash
cd /opt/homeserver/apps/seulgae-tech-lab
./status.sh
./logs.sh backend
./logs.sh frontend
tail -n 30 /opt/homeserver/config/seulgae-tech-lab/ops/history.jsonl
tail -n 100 /opt/homeserver/config/seulgae-tech-lab/ops/commands.log
docker inspect postgres-postgres-1 --format '{{.State.Health.Status}}'
docker exec postgres-postgres-1 sh -c 'pg_isready -U "$POSTGRES_USER" -d stlab_prod'
docker stats --no-stream
free -h
df -h /
curl --fail --silent --show-error http://127.0.0.1:8082/api/health
```

InvenCore의 과거 기준값 비교에는 기존 `bash deploy/audit-existing.sh check`도 사용할 수 있다. 다른 정상 유지보수에서 기존 컨테이너가 갱신되면 과거 기준값과 차이가 생길 수 있다. 새로운 운영 명령은 각 작업 직전·직후의 상태를 비교한다.

공유 PostgreSQL·Kafka·Redis·InvenCore의 restart/down, Docker system prune, volume rm은 연구소 운영 명령에 포함하지 않는다. 포트를 변경하거나 기존 Funnel을 reset하지 않는다. 사용자가 InvenCore를 중지하고 기존 Funnel의 대상을 연구소 루프백 웹 포트로 변경했음을 확인했다. 운영 스크립트는 이 상태를 유지하며 Funnel 설정을 수정하지 않는다.

## GitHub Secrets 등록과 자동 배포 활성화

GitHub 저장소 Settings → Secrets and variables → Actions에서 다음 Repository secrets/variables를 등록한다. production environment에 등록한다면 같은 이름 설정의 우선순위에도 주의한다.

| 종류 | 이름 | 내용 |
| --- | --- | --- |
| Secret | TAILSCALE_AUTHKEY | CI용 reusable·ephemeral auth key. CI에서 이 서버 TCP 22만 접근할 수 있는 tailnet ACL 설정 |
| Secret | DEPLOY_SSH_PRIVATE_KEY | 연구소 전용 CI 개인키 전체. 기존 개인용 homeserver 키는 사용하지 않음 |
| Secret | DEPLOY_SSH_KNOWN_HOSTS | 확인된 서버 호스트 공개키. 접속 대상 호스트명과 일치해야 함 |
| Variable | DEPLOY_HOST | `seulgae-server.tailac4b36.ts.net` |
| Variable | DEPLOY_USER | `seulgae` |
| Variable | DEPLOY_ENABLED | 등록·접속 검증 전에는 미설정 또는 false, 완료 후에만 true |

전용 공개키는 서버 `~/.ssh/authorized_keys`에 `restrict,command="/opt/homeserver/apps/seulgae-tech-lab/deploy.sh"` 제한을 붙여 등록한다. 이 키로 일반 셸이나 포트 포워딩을 사용하지 못하게 하며 기존 암호·개인키·InvenCore 설정은 변경하지 않는다.

이번 설정에서는 전용 CI 키를 Windows의 `$env:USERPROFILE\.config\seulgae-tech-lab\ci\deploy_ed25519`에 생성하고, 현재 사용자만 접근할 수 있도록 디렉터리 ACL을 제한했다. 공개키의 위 제한 등록까지 완료했다. 기존 SSH 세션에서 읽은 서버 호스트 공개키로 같은 폴더의 `known_hosts`를 만들었다. 개인키는 Git에 추가하지 않는다.

GitHub 저장소 [Actions Secrets 설정](https://github.com/seulgae/seulgae-tech-lab/settings/secrets/actions)에서 New repository secret으로 등록한다. PowerShell에서 한 항목씩 클립보드로 복사하고 해당 Secret 값 입력란에 붙여 넣는다. 터미널이나 채팅에 값을 출력하지 않는다.

```powershell
# DEPLOY_SSH_PRIVATE_KEY
Get-Content "$env:USERPROFILE\.config\seulgae-tech-lab\ci\deploy_ed25519" -Raw | Set-Clipboard
# 위 Secret 저장 후 DEPLOY_SSH_KNOWN_HOSTS
Get-Content "$env:USERPROFILE\.config\seulgae-tech-lab\ci\known_hosts" -Raw | Set-Clipboard
```

Tailscale 관리자 콘솔 → Settings → Keys에서 CI 전용 auth key를 생성한다. Reusable과 Ephemeral을 켜고 필요하면 Pre-approved를 사용한다. 기존 tailnet 정책에서 이 CI 노드가 배포 서버의 TCP 22와 연결 확인에 필요한 경로에 접근할 수 있도록 최소 범위를 부여한다. 기존 정책을 무조건 덮어쓰거나 전체 허용하지 않는다. 생성한 값은 `TAILSCALE_AUTHKEY`에 직접 등록한다. 만료 시 Secret도 교체해야 한다.

[Actions Variables 설정](https://github.com/seulgae/seulgae-tech-lab/settings/variables/actions)에 표의 DEPLOY_HOST와 DEPLOY_USER를 등록하고, DEPLOY_ENABLED는 Secrets 등록 완료 전까지 false로 둔다. SSH known_hosts를 실행 시 ssh-keyscan으로 무조건 신뢰하는 방식은 사용하지 않는다.

관련 공식 문서: [Tailscale GitHub Action의 auth key 및 ping 설정](https://github.com/tailscale/github-action), [GHCR 패키지 공개 및 익명 Pull](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility). 패키지의 저장소 접근 권한 상속과 공개 여부는 별도 설정이다.

CI는 PR에서 검증만 수행한다. main의 빌드·테스트가 성공하면 GHCR digest와 release manifest를 게시한다. CI workflow 전체가 성공 완료되면 별도 deploy workflow가 실행된다. main·동일 저장소·성공 이벤트와 DEPLOY_ENABLED 조건을 충족할 때만 Secrets를 사용해 SSH로 고정된 `./deploy.sh`를 실행한다. PR 코드나 다운로드한 artifact를 권한 있는 deploy workflow에서 실행하지 않는다.

Secrets를 등록해도 과거 완료 이벤트가 다시 발생하지는 않는다. 활성화 후 Actions → Build and deploy tech lab → Run workflow에서 main을 선택하고 인자 없이 실행한다. 새 검증·게시가 완료되면 자동 배포가 시작되며 서버 history.jsonl과 status.sh에서 결과를 확인한다.

자동 배포 접속을 실제 확인하기 전에는 수동 배포 성공과 자동 배포 성공을 구분해 보고한다.
