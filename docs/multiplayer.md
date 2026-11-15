# Lobby multiplayer (stage 16)

## Scope and layout

Single in-memory Spring Boot process, one lobby, maximum **5** anonymous visitors. No account, chat, friends, inventory, additional rooms, database migration or Redis. Restarting the app discards visitors; clients reconnect with new IDs. Nicknames are display labels, not authentication. A public anonymous user can occupy a slot; this implementation is not a multi-instance presence service.

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

Only those four fields are accepted. Axes must be integers -1/0/1; input sequence must increase and remain a nonnegative JS-safe integer. Coordinates, elapsed times, velocities, extra fields, fractional axes and replayed sequences are rejected. The browser combines periodic sends and input changes into at most 20Hz, keeping only the latest direction between sends. A stop reaches the next eligible send (normally within 50ms); local movement stops immediately. Per connection: 40 messages/second maximum, 512 UTF-8 bytes maximum, binary input unsupported. This is a per-session rate cap, not an IP-level abuse firewall.

The server integrates at 20Hz with its own monotonic clock, normalizes diagonals, limits speed to 200 world pixels/second and resolves each axis against shared static geometry. Per-step elapsed time is capped at 100ms; input older than 300ms stops moving. Player-to-player collision is intentionally absent. The server does not trust client positions.

Messages: `welcome {selfId, players, maxPlayers}`, `state {tick, players}`, `joined {player}`, `left {id}`. Player fields: `id`, `nickname`, `x`, `y`, `facing`, `moving`, `ack`. Full snapshots recover membership if a transient message is missed. Entry/exit messages use a bounded reliable queue; only the latest unsent movement snapshot is kept. A connection has at most one sender task, 16 queued control messages and one pending state; slow writes/peers are closed. No unbounded per-frame task queue is used.

The client keeps existing Arcade prediction for responsive own movement, but snaps to the server on reconnect or error over 24 world pixels. This is bounded correction, not full input replay/rollback. Other visitors interpolate toward authoritative positions over approximately 80ms and reuse the 4-direction animation sheet. Name tags/tints distinguish self and others.

The server pings every 5s and removes a peer after 15s without input/pong. Browser state silence over 5s triggers reconnect. Reconnect delay doubles from 500ms to an 8s cap. Names are optionally kept in tab-scoped sessionStorage; IDs are never reused. Focus loss queues a stop input. Panel opening stops local input and queues a network stop; closing re-enables it. Socket disposal is emitted before Phaser's asynchronous destroy, so component unmount immediately closes sockets/timers. Scene shutdown also removes remote actors and listeners.

Unexpected closes log their code, reason and clean-close flag in the browser console with the `[multiplayer]` prefix; message-processing exceptions are logged separately without raw message payloads. Code 1008 with `Input rate exceeded` confirms server rate rejection. Code 1006 alone does not identify the cause. Rapid direction changes previously added unbounded change-triggered sends on top of the 20Hz timer, so the client could exceed the server limit; the frontend regression test now changes direction 100 times in one second and asserts only 20 sends including periodic traffic. This code path is locally verified; an individual production disconnect still requires its close code/reason to attribute.

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
