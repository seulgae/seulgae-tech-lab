# 협동 연구실 유즈맵 플랫폼

협동 연구실(office-2)에 들어가면 유즈맵 대기실이 열린다. 방을 만들거나 들어가 방장이 맵을 고르고 시작하면, 맵이 sandbox iframe에서 실행되고 같은 방 사람끼리 메시지를 주고받으며 함께 플레이한다.

## 구조

| 부분 | 위치 | 하는 일 |
| --- | --- | --- |
| 맵 목록 | `shared/usemaps.json` | 화면과 서버가 같이 읽는 맵 id·이름·인원·실행 파일 |
| 맵 파일 | `frontend/public/usemaps/<맵id>/` | 맵 코드(정적 파일). 지금은 예제 `bug-squash` |
| SDK | `frontend/public/usemaps/sdk/usemap-sdk.js` | 맵이 플랫폼과 대화하는 유일한 통로(postMessage) |
| 대기실 화면 | `frontend/src/features/usemap/` | 방 목록·방 만들기·입장·채팅·방 안·게임 화면(iframe) |
| 대기실 서버 | `backend/.../usemap/` | `/ws/usemap`: 방·채팅·게임 메시지 중계(메모리, 판정 없음) |

- 판정은 **방장 브라우저의 맵**이 한다. 서버는 맵마다 코드가 필요 없고, 대신 게임 결과로 동전을 주지 않는다.
- 맵은 `sandbox="allow-scripts"` iframe(출처 없음)에서 돌아 로그인 쿠키·우리 API·우리 화면에 접근할 수 없다.

## 맵 만들기 (SDK)

```html
<script src="../sdk/usemap-sdk.js"></script>
<script>
  SeulgaeUseMap.onInit(({ me, hostId, players, seed, isHost }) => { /* 게임 시작 */ })
  SeulgaeUseMap.onMessage((data, from) => { /* 같은 방 다른 사람이 보낸 값 */ })
  SeulgaeUseMap.send({ k: 's', ... })          // 같은 방 다른 사람에게(직렬화 1KB 이하, 1초 40개)
  SeulgaeUseMap.end({ win: true, score: 10 })  // 방장만 반영
  const rand = SeulgaeUseMap.random(seed)      // 모두 같은 순서의 난수
</script>
```

권장 패턴: 방장(`isHost`)이 상태를 계산해 0.1초마다 `send`로 나눠 주고, 나머지는 입력만 보낸다. 메시지는 짧게(키 한 글자, 숫자 배열).

## 맵 추가 절차

1. `frontend/public/usemaps/<맵id>/index.html`과 코드를 만든다(SDK 경로는 `../sdk/usemap-sdk.js`).
2. `shared/usemaps.json`에 `id`(소문자·숫자·`-`), `name`, `description`, `minPlayers`(1~), `maxPlayers`(~8), `entry`, `version`을 추가한다.
3. 프론트 테스트가 목록 형식과 실행 파일 존재를 확인한다.

나중에 개발자들과 공유하는 별도 맵 저장소를 만들면, 그 저장소의 릴리스 묶음을 2번의 위치로 받아 오도록 바꾼다(맵 버전은 이 저장소에서 고정).

## 대기실 메시지(`/ws/usemap`)

- 보내기: `ping`, `chat{scope,text}`, `create{name,mapId,max,password}`, `join{roomId,password}`, `leave`, `ready{ready}`, `map{mapId}`, `start`, `game{data}`, `end{result}`
- 받기: `welcome{you,maps}`, `rooms{rooms}`, `room{room}`, `left`, `chat`, `start{mapId,hostId,players,seed}`, `game{from,data}`, `end{result}`, `error{message}`
- 제한: 연결 200개, 방 50개, 방 최대 8명, 방 이름 20자, 대화 100자(0.7초에 한 번), 게임 메시지 1초 40개, 메시지 1KB, 20초 동안 아무것도 안 보내면 끊김(화면은 10초마다 ping).
