# Lobby multiplayer (stages 16–17)

## Scope and layout

Single in-memory Spring Boot process, one lobby, maximum **5** anonymous visitors. Bounded plain-text lobby chat is supported. No account, friends, inventory, additional rooms, database migration or Redis. Restarting the app discards visitors; clients reconnect with new IDs. Nicknames are display labels, not authentication. A public anonymous user can occupy a slot; this implementation is not a multi-instance presence service.

- `backend/.../multiplayer/lobby/domain`: room state, normalized movement and collision.
- `backend/.../multiplayer/lobby/websocket`: sessions, protocol, scheduling, limits and cleanup.
- `backend/.../multiplayer/lobby/config`: strict Origin handshake and container buffer limits.
- `frontend/src/features/multiplayer`: browser socket lifecycle, protocol validation and React status.
- `frontend/src/game/multiplayer`: local correction, remote actors/interpolation and name labels.
- `shared/lobby-world.json`: world dimensions, feet geometry, walls, furniture and five safe spawn points, read by both server and client. Maven packages it as a classpath resource; frontend and backend Docker build contexts include it. Keep visual and collision updates in this shared file.

## Protocol and authority

Endpoint: `/ws/lobby`, no STOMP or SockJS. The browser derives `ws:` or `wss:` from its page protocol and uses the same host. Vite proxies `/ws`; nginx forwards Upgrade/Connection and Origin headers while preserving existing API proxy routes.

Optional `nickname` query: 1–16 Unicode letters/numbers, underscore or hyphen. Omission generates `연구원-xxxx`; name collisions receive a suffix. IDs are server-generated UUIDs. Invalid names close with 1008; a full lobby closes with 1013.

Client input example:

```json
{"type":"input","x":1,"y":0,"seq":1}
```

Only those four fields are accepted. Axes must be integers -1/0/1; input sequence must increase and remain a nonnegative JS-safe integer. Coordinates, elapsed times, velocities, extra fields and fractional axes are rejected. Stale/replayed sequences are ignored without applying movement or closing an otherwise healthy connection; the first occurrence is logged. The browser combines periodic sends and input changes into at most 20Hz while moving, keeping only the latest direction between sends. Once a stop has been sent, no further idle movement messages are sent. A stop reaches the next eligible send (normally within 50ms); local movement stops immediately. Per connection: a token bucket replenishes 40 message permits/second, holds at most 80 permits, and consumes one permit per movement input; chat uses a separate 3-token bucket replenished at 1 token/second. This absorbs short delivery bursts while rejecting sustained excessive traffic; it is not a strict 40-message limit in each individual second. Movement input remains limited to 512 UTF-8 bytes; chat requests have a 1024-byte frame cap. Binary input is unsupported. This is a per-session rate cap, not an IP-level abuse firewall.

The server integrates at 20Hz with its own monotonic clock, normalizes diagonals, limits speed to 200 world pixels/second and resolves each axis against shared static geometry. Per-step elapsed time is capped at 100ms; input older than 300ms stops moving. Player-to-player collision is intentionally absent. The server does not trust client positions.

Messages: `welcome {selfId, players, maxPlayers, protocolVersion:3}`, `state {tick, players}`, `joined {player}`, `left {id}`, and the chat messages documented below. Player fields: `id`, `nickname`, `x`, `y`, `facing`, `moving`, `ack`. Full snapshots recover membership if a transient message is missed. Entry/exit/chat/history messages use a bounded reliable queue; only the latest unsent movement snapshot is kept. A connection has at most one sender task, 16 queued control messages and one pending state; slow writes/peers are closed. No unbounded per-frame task queue is used. A new client only enables chat after a version-3 welcome, preventing unsupported chat requests against an older running backend. Restart the backend when changing Java code; Vite HMR alone does not update it.

The client keeps Arcade prediction and up to 256 sent-input position samples. Authoritative positions are compared with the historical prediction for their `ack`, preserving later local movement. Small moving errors <=16px are tolerated; stopped residual error uses 2px. Normal correction happens once after physics POST_UPDATE at <=60px/s, with shared-geometry collision checks and synchronized Sprite/Body translation preserving velocity and foot offsets. Reconnect and >128px ack-aligned errors use the authoritative position once. Missing history is given a 1s grace before a large-error resync. Socket callbacks never reset the local Body. This is bounded ack-based reconciliation, not full input replay/rollback. Remote visitors retain separate approximately 80ms interpolation and existing animations. See [movement stability measurements](movement-stability.md) for reproduction, limitations and opt-in diagnostics.

The server pings every 5s and removes a peer after 15s without input/pong. Browser state silence over 10s triggers code 4001; excessive outgoing buffering triggers 4003. Invalid server frames trigger 4002. Rendering/status callback exceptions are logged separately and do not close the socket. Reconnect delay doubles from 500ms to an 8s cap; at most one pending retry is retained. Names are optionally kept in tab-scoped sessionStorage; IDs are never reused. Focus loss queues a stop input. Panel opening stops local input and queues a network stop; closing re-enables it. GameCanvas owns one client/socket per mounted game component. Scene shutdown removes its subscription, actors, bubbles and physics listeners; it does not destroy the shared client. Component unmount explicitly closes the socket/timers before Phaser destruction.

Unexpected closes log their code, reason and clean-close flag in the browser console with the `[multiplayer]` prefix; message-processing exceptions are logged separately without raw message payloads. Code 1008 with `Input rate exceeded` confirms server rate rejection. Invalid input now distinguishes `fields`, `axes`, `sequence`, and `JSON`; chat shape/content/rate errors use a private `chat_error` response without changing movement ACK or closing a healthy connection. Code 1006 alone does not identify the cause. Rapid direction changes previously added unbounded change-triggered sends on top of the 20Hz timer; regression tests now change direction 100 times in one second and verify 50ms send spacing (21 sends when including both endpoints). The user reported `Invalid input` at only 10–12 sends, and reported recovery after restarting their backend. That supports an outdated-running-backend explanation but does not prove which rejected payload caused the old generic error; no original payload or production trace was available.

The browser close log also includes `sentInputs`, `connectedMs`, and `sentLastSecond`. Backend close logs include `player`, `code`, `reason`, `receivedInputs`, and `connectedMs`; rate rejection additionally produces a warning. Inspect them with `./logs.sh backend --follow`. No payloads or credentials are logged. The previous fixed one-second receive counter rejected even correctly paced traffic if more than 40 inputs arrived together after buffering. A real-socket regression test reproduces that failure using a 45-input delivery batch, then verifies acceptance plus continued 20Hz input with the token bucket. A separate flood test still verifies policy rejection. Production transport buffering itself has not been observed locally.

## Lobby chat

The E-key greeting, nearest-player hint, fixed message and greeting protocol have been removed. E still opens the nearby computer research panel. Enter focuses the React chat input; Enter sends, Shift+Enter adds a newline, and ESC cancels/releases focus. Text focus and focus transitions stop/reset game keys. See [stage 17 chat](chat.md) for protocol, independent validation, bounded history and verification.

## Origin and configuration

Allowed defaults are exactly:

- `http://localhost:5173`, `http://127.0.0.1:5173`
- `http://localhost:5188`, `http://127.0.0.1:5188`
- the existing HTTPS service origin recorded in the project configuration

Production Compose explicitly sets `LAB_MULTIPLAYER_ALLOWED_ORIGINS` to `https://seulgae-home-server.tailac4b36.ts.net,http://127.0.0.1:5188,http://localhost:5188`. These override the Java development defaults above; the old public domain is not allowed in this deployment. The integration tests verify welcome frames for all three allowed origins and HTTP 403 for the old domain, foreign/missing origins, lookalike hosts and wrong schemes/ports. See [safe server updates](operations.md).

Override with Spring property `lab.multiplayer.allowed-origins` / environment `LAB_MULTIPLAYER_ALLOWED_ORIGINS` if the actual public URL differs. Use comma-separated exact origins without paths or trailing slashes; wildcards and absent Origin are rejected. Origin checking is not authentication and cannot identify a trusted non-browser client.

`LAB_DEV_BACKEND_URL` optionally changes the local Vite HTTP/WS proxy target (default `http://127.0.0.1:8080`). Production always uses same-origin `/api` and `/ws/lobby`. No secrets are needed or embedded in frontend code.

## Local validation without a DB

Backend: `mvn -f backend/pom.xml clean verify`. Tests start a real random-port Tomcat with the production WebSocket classes and an explicitly configured **test-only** research repository. It is not packaged in the application JAR and never reads development/production DB credentials. Tests cover movement normalization/expiry, world/furniture clipping, 2-client movement and entry/exit, new IDs on reconnect, 5-player capacity, names, frame size, rate, replay/coordinate rejection, Origin rejection and existing HTTP read contracts.

Frontend: from `frontend/`, run `npm test`, `npm run lint`, `npm run build`. Tests cover protocol validation, HTTPS/WSS selection, URL construction, membership, heartbeat/input state, reconnection timers and dispose cleanup, alongside existing interaction/API/asset tests.

To reproduce browser verification locally (Java 17, Maven and Node configured), first prepare the test classpath:

```powershell
mvn -f backend/pom.xml test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=target/test-classpath.txt
$testClasspath = 'backend/target/test-classes;backend/target/classes;' + (Get-Content backend/target/test-classpath.txt -Raw).Trim()
java -cp $testClasspath kr.seulgae.techlab.multiplayer.lobby.LocalLobbyTestApplication --server.port=8091
```

In another terminal, from `frontend/`:

```powershell
$env:LAB_DEV_BACKEND_URL = 'http://127.0.0.1:8091'
npm run dev -- --port 5188 --strictPort
```

Open `http://127.0.0.1:5188/` in two independent pages. This fixture serves one clearly labeled local research record through the real HTTP controller/service with a fixed repository. It does not validate live PostgreSQL connectivity. It is exclusively for local validation; do not run it as the deployed backend.

Browser checks performed: two-player display, A movement visible in B, departure count, refresh/rejoin, automatic reconnect after local backend restart, E-opened research list/detail, panel close, and read-only research fallback when WS alone is rejected. The latter used local port 5190, deliberately outside the allowed Origin list, while HTTP read proxying stayed available. No server access or deployment test is required for these checks.

## User-owned deployment checks

No production server access, manual deploy, GitHub Actions execution/result monitoring, or production DB operation is part of this task. After deployment, the user should check same-origin WSS through nginx/Tailscale, the exact public Origin, multiple browser engines/networks, long-lived connections, ordinary research reads and reconnect after a real deployment. Local Docker/nginx execution depends on available tools; where Docker/nginx are unavailable, container/proxy runtime verification remains a user/CI check.

## 완료 스텝 이동 프로토콜 v4 (2026-11-16)

새 서버의 welcome은 `protocolVersion: 4`를 보낸다. 새 클라이언트는 Arcade `WORLD_STEP`이 실제로 완료한 각 스텝을 기록해 최대 20Hz, 메시지당 8개 이하로 묶는다.

```json
{"type":"move","inputs":[{"x":1,"y":0,"ms":16.666666666666668,"seq":1},{"x":0,"y":0,"ms":0,"seq":2}]}
```

`seq`는 물리 스텝 명령 번호이고 `ms`는 해당 스텝의 시간이다. 좌표와 클라이언트 절대 시각은 전송하지 않는다. 방향 전환을 전송 간격 사이에 버리지 않고 순서대로 보관한다. 정지는 0ms 명령 한 번이며, 이후 유휴 이동 메시지를 보내지 않는다. 물리 스텝이 한 렌더 프레임에 두 번 실행돼도 각각 기록하므로 30Hz 렌더링을 30Hz 물리로 오인하지 않는다.

서버는 필드·정수 방향·연속 번호·스텝당 0~50ms·메시지당 8개·전체 메시지 1024바이트를 검증한다. 이동 방향에 0ms는 허용하지 않는다. 기존 메시지 빈도 제한도 유지한다. 서버 단조 시계로 충전되는 이동 시간 예산은 초기 250ms, 최대 2000ms이며 명령 시간만큼 소비한다. 예산이 부족한 정상 명령은 즉시 거부하지 않고 최대 2000ms·240명령의 서버 대기 큐에 보관한다. 서버 갱신에서 예산이 충전된 만큼 순서대로 처리한다. 한도 초과·잘못된 방향/시간/순번은 거부한다. 서버의 200px/초 정규화 이동과 공통 맵 충돌을 유지하고, 이미 수신한 명령을 다시 대기시키거나 중복 적용하지 않는다.

v4 플레이어의 `ack`는 **스텝 처리가 끝난 위치**를 가리킨다. 서버는 수신 순번과 완료 순번을 구분한다. 서버 주기 갱신은 검증된 대기 명령만 처리하며 받지 않은 이동을 추가 적분하지 않는다. 클라이언트는 해당 서버 위치에서 `ack` 이후의 미확인 스텝만 재생한다. 같은 ack의 반복 스냅샷으로 정지 위치를 계속 보정하지 않는다. 예측은 600스텝, 송신 대기는 120스텝으로 제한하고 초과하면 재접속한다. 종료 시 예측 기록·대기 명령·물리 리스너를 정리한다.

배포 중 구형 캐시와의 호환을 위해 기존 `input`은 구형 서버 틱 방식으로 처리한다. v4 명령을 사용한 플레이어는 다시 구형 입력으로 전환하지 못한다. 새 클라이언트가 구형 서버에 연결되면 기존 입력 방식으로 동작한다. **수정 반영을 확인할 때는 두 창을 모두 새로고침한다.** `?netDebug=1`의 `[multiplayer] 이동 프로토콜`에서 `version: 4`, `mode: completed-steps`를 확인할 수 있다.

서버까지의 전송 시간 자체는 남는다. 채팅 v3의 메시지 구조와 연구 API는 변경하지 않는다.

## 원격 표시와 종료 진단 보완 (2026-11-16)

welcome과 state의 선택 필드 `time`은 서버 단조 시계의 밀리초다. 클라이언트는 이 시간의 위치 표본을 최대 120개 보관하고, 수신 지터에 따라 100~650ms의 표시 버퍼를 사용한다. 이동 중 중복 위치 틱은 잠깐의 정지로 취급하지 않는다. 긴 유휴 후 첫 이동에 시작점을 추가하고, 표본 사이만 보간한다. 새 데이터가 없을 때 마지막 위치를 넘겨 외삽하지 않으며 긴 단절 후에는 재생 시계를 다시 맞춘다. 원격 표시의 따라잡기 속도는 최대 260px/초다. 이는 본인 이동 속도나 서버 검증 속도를 변경하지 않는다. 구형 서버에 time이 없으면 수신 시각을 사용한다.

버퍼는 표시 지연을 추가하는 대신 수신 간격의 흔들림을 흡수한다. 지터가 버퍼 한도를 넘거나 전송이 완전히 끊기면 일시 정지는 남을 수 있다. 정상 접속에는 진단 로그를 추가하지 않는다. `?netDebug=1`일 때 `[multiplayer:remote]`에서 프레임·표시 중 정지 프레임·속도 변동·버퍼 시간을 집계한다. 충돌과 방향 전환이 섞인 집계를 일정 속도 구간의 품질과 같은 의미로 해석하면 안 된다.

검증 실패의 종료 사유는 `Invalid movement: fields`, `Movement axes`, `Movement duration`, `Movement sequence`, `Movement backlog exceeded`처럼 분리한다. 1008 발생 시 `[multiplayer:movement-rejected]`에는 마지막 전송 명령의 방향·시간·순번과 대기 개수만 기록한다. 좌표·원문 채팅·토큰·개인정보는 기록하지 않는다.
