# 서버실 랙 용량 조사 (2026-11-23)

서버실 랙 4개가 각각 다른 용량 정보를 보여 준다. 호스트 값은 백엔드가 **Apache MINA SSHD**(`sshd-core` 2.16.0)로 호스트에 SSH 접속해 30초마다 수집한다. JVM 값은 백엔드 자신의 MXBean에서 읽는다. DB에는 저장하지 않고, 마지막 값과 최근 30회(약 15분) 추이만 메모리에 둔다.

| 랙 | 분류 | 보여 주는 값 | 출처 |
|---|---|---|---|
| 1번 | CPU 실시간 사용량 | 사용률(100 − idle), user·system·iowait, 부하 평균 1·5·15분, 코어 수, 코어당 부하, JVM 프로세스 CPU, 80% 초과 경고, 15분 추이 | `vmstat 1 2`(두 번째 줄), `/proc/loadavg`, `nproc`, OperatingSystemMXBean |
| 2번 | 메모리 사용량 | 사용률((전체 − 가용) ÷ 전체), 전체·사용·가용·버퍼캐시, 스왑, JVM 힙 최대 ÷ 전체, 80% 경고, 15분 추이 | `free -b`, MemoryMXBean |
| 3번 | JVM 힙 | 힙 사용·확보·최대와 사용률, 힙 외 메모리, GC 횟수·누적 시간(가동 대비 %), 스레드(최고) | MemoryMXBean, GarbageCollectorMXBean, ThreadMXBean |
| 4번 | 가동시간 | 서버 가동시간·부팅 시각, JVM 가동시간·시작(배포) 시각, 수집 상태·마지막 수집 시각 | `/proc/uptime`, RuntimeMXBean |

- API: `GET /api/lab/capacity`(공개). 퍼센트·MiB·초 같은 집계값만 내보낸다. 호스트 이름·IP·계정·명령 출력·오류 원문은 넣지 않고, 실패는 짧은 분류 코드만 쓴다(`NOT_CONFIGURED`, `CONNECT`, `TIMEOUT`, `EXIT`, `PARSE`).
- SSH 설정이 없으면 JVM 값(1번의 JVM CPU, 3번, 4번의 JVM)만 보이고, 호스트 값 자리에는 "설정되지 않았어요"가 뜬다.

## 구현 메모 (블로그 "JSch → MINA SSHD" 글의 방식 그대로)

- `SshClient.setUpDefaultClient()`는 한 번 만들어 재사용한다. 수집마다 세션을 열고 닫는다.
- 연결·인증·채널 열기·명령 종료의 모든 비동기 단계에 `verify(10초)` / `waitFor(CLOSED, 10초)` 상한을 둔다. `TIMEOUT` 이벤트와 종료 코드도 검사한다.
- 셸이 아니라 `CHANNEL_EXEC` 채널을 쓴다. 표준출력과 표준에러를 나눠 받는다.
- try-with-resources로 채널 → 세션 순서로 닫는다. 닫는 중 예외는 원래 예외에 덧붙어(suppressed) 원인을 가리지 않는다.
- 블로그 글과 다른 점
  - 비밀번호 대신 **키 인증만** 쓴다.
  - 호스트 키를 **known_hosts로 검증**하고, 모르는 키는 거절한다.
  - 운영 키는 `command=`로 **프로브 하나만** 실행되게 묶는다(아래).

## 켜는 방법 (운영 서버, 사용자 작업)

1. 수집 전용 키를 만든다. 비밀번호 없는 ed25519이고, 이 기능에만 쓴다.
   ```sh
   ssh-keygen -t ed25519 -N '' -C stlab-capacity -f /opt/homeserver/config/seulgae-tech-lab/capacity/id_ed25519
   ```
2. 수집용 계정의 `~/.ssh/authorized_keys`에 **강제 명령과 제한**을 붙여 등록한다. 이 키로는 프로브 외에 셸·포워딩·pty가 모두 막힌다.
   ```text
   restrict,command="/opt/homeserver/apps/seulgae-tech-lab/deploy/capacity-probe.sh" ssh-ed25519 AAAA... stlab-capacity
   ```
3. 호스트 키를 known_hosts 파일로 저장한다. 컨테이너에서 접속할 이름(아래 `host.docker.internal`)으로 저장해야 한다.
   ```sh
   ssh-keyscan -t ed25519 localhost | sed 's/^localhost/host.docker.internal/' > /opt/homeserver/config/seulgae-tech-lab/capacity/known_hosts
   ```
4. `compose.yml`의 backend에 아래를 더한다. 키 파일은 이미지·저장소에 넣지 않고 읽기 전용으로 마운트한다.
   ```yaml
   extra_hosts: ["host.docker.internal:host-gateway"]
   environment:
     LAB_CAPACITY_SSH_HOST: host.docker.internal
     LAB_CAPACITY_SSH_USER: <수집용 계정>
     LAB_CAPACITY_SSH_KEY_PATH: /run/capacity/id_ed25519
     LAB_CAPACITY_SSH_KNOWN_HOSTS_PATH: /run/capacity/known_hosts
   volumes:
     - /opt/homeserver/config/seulgae-tech-lab/capacity:/run/capacity:ro
   ```
   키 파일은 컨테이너 사용자가 읽을 수 있어야 한다. 컨테이너의 uid를 확인해 소유자를 맞추고 개인키는 600으로 둔다.
   ```sh
   docker exec seulgae-tech-lab-backend-1 id          # uid 확인
   sudo chown -R <uid> /opt/homeserver/config/seulgae-tech-lab/capacity
   chmod 600 /opt/homeserver/config/seulgae-tech-lab/capacity/id_ed25519
   ```
   배포는 저장소의 `compose.yml`을 기준으로 하므로, 서버에서만 고치면 다음 배포 때 덮어써질 수 있다. 이 변경은 저장소 PR로 반영한다(`deploy/test_compose.py` 검사도 함께 맞춘다).
5. 배포 후 4번 랙의 "호스트 수집"이 "정상 수집 중"이 되는지 본다. 1번(CPU)·2번(메모리) 랙에도 호스트 값이 나온다. 실패하면 백엔드 로그에서 `[capacity]`를 찾는다.
   ```sh
   docker logs seulgae-tech-lab-backend-1 | grep capacity
   ```

## 실패 코드별 흔한 원인

| 코드 | 흔한 원인 |
|---|---|
| `NOT_CONFIGURED` | 환경 변수 누락, 또는 키·known_hosts 파일을 컨테이너가 읽지 못함(마운트·권한) |
| `CONNECT` | 계정 이름이 다름, 키가 authorized_keys에 없음, known_hosts의 이름이 `host.docker.internal`이 아님(호스트 키 불일치로 거절) |
| `EXIT` | `capacity-probe.sh` 실행 권한 없음, authorized_keys의 command 경로가 틀림 |
| `TIMEOUT` | 컨테이너에서 호스트 22번 포트로 가는 길이 막힘(방화벽, `extra_hosts` 누락) |
| `PARSE` | 호스트에 `vmstat`·`free`가 없거나 출력 형식이 다름(`procps` 설치 확인) |

선택 설정: `LAB_CAPACITY_SSH_PORT`(기본 22), `LAB_CAPACITY_INTERVAL_MS`(기본 30000).
