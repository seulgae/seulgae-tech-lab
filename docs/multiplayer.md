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
