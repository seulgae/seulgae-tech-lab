# 방별 상호작용

방 이동([rooms.md](rooms.md))으로 생긴 세 방에 각각의 E 상호작용을 붙였다. 출입구가 항상 우선이며, E 한 번에 대상 하나만 실행한다.

| 방 | 대상 | 종류(`kind`) | 동작 |
|---|---|---|---|
| 개발 연구실 | 가운데 슈퍼컴퓨터 | `pull-requests` | GitHub PR 목록(열린 PR·최근 머지, 서버가 GitHub 공개 API를 5분 캐시, `GET /api/lab/pulls`). 2026-11-23 연구 기록·아이디어 일지를 지우고 바꿨다 |
| 개발 연구실 | 좌·우 컴퓨터 | `build-info` | 실행 중인 백엔드의 버전·커밋·빌드 시각·Java 버전 |
| 서버실 | 1~4번 랙(왼쪽부터) | `server-status` | 랙마다 용량 조사 한 분류: 1번 CPU, 2번 메모리, 3번 JVM 힙, 4번 가동시간 (5초마다 갱신, [server-capacity.md](server-capacity.md)) |
| 회의실 | 회의 테이블 | `table-talk` | 테이블 대화 켜기/끄기. 켜면 테이블 주변 참가자에게만 채팅 전달 |

## 공유 맵

`shared/lobby-world.json`의 각 `rooms.<id>.interactions`에 `id`, `kind`, `label`, 중심 `x`·`y`, `width`·`height`, `range`를 둔다. 범위는 기존 `isNearObject`와 같이 **사각형 가장자리까지의 거리**로 판정한다. 서버 `LobbyWorld.Interaction.near`도 같은 식을 사용한다. 모든 방의 스폰은 어떤 상호작용 범위에도 들지 않는다 (서버·클라이언트 테스트로 검증).

Scene은 방마다 `nearestInteraction()`로 가장 가까운 대상 하나를 고르고, 강조 사각형과 안내 문구를 그 대상의 크기·위치로 옮긴다. 컴퓨터 위치에 고정된 로비 전용 강조 코드는 제거했다.

## HTTP API (읽기 전용, 인증 없음)

`GET /api/lab/status` (`Cache-Control: no-store`)

```json
{"status":"UP","uptimeSeconds":3725,"onlinePlayers":2,"maxPlayers":5,
 "rooms":[{"id":"lobby","name":"중앙 로비","players":1}, ...],
 "memory":{"usedMb":80,"maxMb":512},"serverTime":"2026-11-16T12:00:00Z"}
```

`GET /api/lab/build`

```json
{"version":"0.0.1-SNAPSHOT","commit":"ad32afb","builtAt":"2026-11-16T11:58:00Z","javaVersion":"17"}
```

- 집계값만 공개한다. 호스트 이름·IP·DB 상태·환경 변수·닉네임은 응답에 없다. 방별 인원은 이미 소켓 `state`의 `totalOnline`과 방 스냅샷으로 공개되는 정보와 같은 수준이다.
- 버전·빌드 시각은 `spring-boot-maven-plugin`의 `build-info` goal이 만드는 `META-INF/build-info.properties`에서 읽는다. 없으면 `dev`/`null`.
- 커밋은 `lab.build.commit` (`LAB_BUILD_COMMIT`) 값이 7~40자리 소문자 16진수일 때만 앞 7자리를 쓰고, 아니면 `local`로 표시한다. CI `publish` 단계가 `GIT_COMMIT=${{ github.sha }}` 빌드 인자를 넘기고, 백엔드 Dockerfile 런타임 단계가 이를 `LAB_BUILD_COMMIT`으로 설정한다. PR CI의 `docker build`와 로컬 빌드는 `local`이다.
- nginx는 기존 `location /api/` 프록시로 전달하므로 설정 변경이 없다.
- 프런트엔드 `labTypes.ts`가 응답 형식·길이·커밋 형식을 검증한 뒤에만 표시한다. 패널이 닫히면 요청과 갱신 타이머를 함께 정리한다.

## 테이블 대화 프로토콜

기존 채팅 요청에 선택 필드 `scope`를 추가했다. 일반 대화는 이전과 같은 형식(`scope` 없음)으로 보낸다.

```json
{"type":"chat","message":"여기서만","scope":"table","roomEpoch":3}
```

- 서버는 `scope`가 없거나 `room`/`table`일 때만 받는다. 그 밖의 값은 기존 규칙대로 채팅 예산을 소비한 뒤 `chat_error: invalid`로 거부하며 연결은 유지한다.
- `table`은 **서버 좌표**가 현재 방의 `table-talk` 범위 안일 때만 허용한다. 아니면 `chat_error: not_at_table`. 현재는 회의실에만 `table-talk`가 있다.
- 수신자는 같은 방에서 서버 좌표가 테이블 범위 안인 참가자뿐이다. 발신자도 같은 조건으로 자신의 메시지를 받는다.
- 테이블 대화는 방 최근 기록 50개에 저장하지 않는다. 방 이동·새로고침 후에는 다시 보이지 않는다.
- `chat_message`에 `scope`(`room` 또는 `table`)를 붙인다. 구형 클라이언트는 이 필드를 무시해도 동작이 같고, 새 클라이언트는 `room`/`table` 외의 값을 가진 프레임을 거부한다.
- 길이·제어 문자·초당 1개 보충·여유 3개 전송 제한은 일반 채팅과 같은 예산을 공유한다.

클라이언트에서는 테이블 범위 안에서 E로 켜고 끈다. 범위를 벗어나거나, 방을 이동하거나, Scene이 종료되면 자동으로 꺼진다. 켜져 있는 동안 채팅 머리글에 "테이블 대화 중"이 표시되고, 테이블 메시지에는 "테이블" 표시가 붙는다. 테이블 대화 토글은 이동을 잠그지 않는다.

## 검증

- 백엔드: `RoomInteractionTest`가 실제 서버 이동만으로 회의실 테이블에 접근해 범위 판정, 거부 사유, 기록 미저장, 수신자 목록, 상태 집계, 커밋 값 검증을 확인한다. `LobbySocketTest`는 실제 WebSocket에서 범위 밖 `not_at_table`, 알 수 없는 범위 `invalid`, 일반 메시지의 `scope: room`을 확인한다.
- 프런트엔드: `interaction.test.mjs`가 네 방의 대상 선택, 패널 이벤트와 입력 잠금, 리스너 정리, 테이블 대화 토글·자동 해제를 검증한다. `chat-scope.test.mjs`는 프로토콜 검증, 전송 형식, 상태·빌드 응답 검증을 다룬다.
- 로컬 브라우저 확인은 `LocalLobbyTestApplication`(DB 없음)에 `LabStatusController`를 추가해 [multiplayer.md](multiplayer.md)의 절차로 실행한다.
