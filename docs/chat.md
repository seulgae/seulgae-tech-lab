# 17단계 — 로비 실시간 채팅

## 범위와 파일

기존 `/ws/lobby` 하나로 이동·접속 상태와 일반 텍스트 채팅을 처리한다. E 키 인사, 가장 가까운 플레이어 선택, 고정 인사 문구와 인사 전용 프로토콜·쿨다운·GreetingBubble은 제거했다. E는 기존 컴퓨터 연구 기록 기능만 실행한다. DB 영구 저장, 로그인, 귓속말, Kafka 및 추가 소켓은 없다.

| 파일 | 책임 |
| --- | --- |
| backend/.../domain/LobbyChat.java | 발신자 확인, 150 코드 포인트 제한, 별도 전송 예산, 최근 50개 기록 |
| backend/.../domain/LobbyRoom.java | 기존 이동 유지, 접속자 읽기, 인사 제거, Unicode 닉네임 접미사 경계 보존 |
| backend/.../websocket/LobbySocketHandler.java | 이동·채팅 라우팅, 입장 기록과 실시간 방송 순서, 개별 오류 응답 |
| backend/.../config/LobbyWebSocketConfig.java | 전체 텍스트 프레임 1024 상한, 기존 Origin 검증 유지 |
| frontend/src/features/multiplayer/model/protocol.ts | 채팅·기록·오류 검증, 프로토콜 버전 3 |
| frontend/src/features/multiplayer/MultiplayerClient.ts | 단일 소켓, 구독, 기록/메시지 중복 제거, 채팅 전송과 이동 분리 |
| frontend/src/components/GameCanvas.tsx | 소켓 수명 소유, React 채팅 상태, 게임 영역 포커스 |
| frontend/src/features/multiplayer/components/ChatPanel.tsx, ChatPanel.css | 입력·내역·시간·접기/펼치기·스크롤·게임 키 분리 |
| frontend/src/game/multiplayer/ChatBubble.ts | 5초 말풍선, 마지막 400ms 페이드, 줄바꿈·경계·객체 재사용 |
| frontend/src/game/multiplayer/LobbyMultiplayer.ts | Scene 소켓 구독, 현재 발신자 말풍선, 퇴장/종료 정리 |
| frontend/src/game/scenes/LabLobbyScene.ts, game/interaction.ts | 채팅 포커스 전환 시 키 초기화, 컴퓨터 E 유지, 인사 제거 |
| backend/src/test/.../LobbyChatTest.java, LobbySocketTest.java | 검증·기록·사칭·Unicode/바이트 경계·방송·이동 연결 회귀 |
| frontend/tests/multiplayer.test.mjs, chat-bubble.test.mjs, interaction.test.mjs, reconciliation.test.mjs | 중복/기록 분리·메모리 상한·키 차단·말풍선 수명·공유 소켓 구독과 이동 회귀 |

## 프로토콜

서버 welcome의 `protocolVersion`은 **3**이다. 이 버전 확인 전에는 클라이언트가 채팅을 보내지 않는다. 이전 백엔드를 실행 중이면 Java 프로세스도 갱신해야 하며 Vite HMR만으로 백엔드는 바뀌지 않는다.

요청 필드는 아래 두 개만 허용한다.

```json
{"type":"chat","message":"안녕하세요!"}
```

서버는 접속에 연결된 플레이어로 ID와 닉네임을 정하고 UUID와 UTC 시각을 생성한다. 클라이언트가 발신자·닉네임·시각을 지정할 수 없다.

```json
{
  "type":"chat_message",
  "messageId":"<server UUID>",
  "playerId":"<session player UUID>",
  "nickname":"연구원-xxxx",
  "message":"안녕하세요!",
  "sentAt":"2026-11-16T00:00:00Z"
}
```

신규 접속 시 welcome 다음에 `chat_history {messages:[...]}`를 먼저 큐에 넣는다. 그 후의 실시간 방송과 입장 기록을 동일한 채팅 잠금으로 순서화해 기록 조회와 구독 사이의 누락을 막는다. 큐는 기존 연결별 16개 제어 메시지/최신 상태 1개 제한을 유지한다. 50개 기록을 수용할 수 있도록 송신 버퍼는 64KiB로 제한한다.

채팅 검증 오류는 해당 연결에만 `chat_error {reason:...}`로 알린다. 사유는 `empty`, `too_long`, `invalid`, `rate_limited`, `unavailable`이다. 내용 검증 실패만으로 정상 이동 연결을 끊지 않는다. 과대한 프레임, 손상된 JSON, 알 수 없는 메시지 타입, 느린 송신/제어 큐 초과는 기존 연결 보호 정책에 따라 정리할 수 있다.

## 검증·제한·보관

- 현재 접속한 플레이어만 전송할 수 있다. 퇴장 시 채팅 제한 상태를 제거한다.
- CRLF/CR을 LF로 정규화하고 앞뒤 공백을 제거한다. 공백뿐인 내용, 제어 문자 및 단독 surrogate는 거절한다. 탭·줄바꿈은 허용한다.
- 최대 **150 Unicode 코드 포인트**다. 이모지 150개도 처리하며 사용자 인식 글자 묶음(grapheme) 150개를 의미하지 않는다. 브라우저와 서버 모두 검사한다.
- 텍스트 프레임은 1024 UTF-8 bytes, 이동 입력은 기존 512 bytes 제한을 별도로 유지한다. 클라이언트 수신 프레임은 최근 50개를 담을 수 있는 64KiB 문자 길이 상한을 둔다.
- 서버 채팅 예산은 연결별 최대 3개 여유분, 초당 1개 보충이다. 잘못된 채팅 요청도 이 예산을 소비한다. 클라이언트는 전송 사이 최소 1초를 둔다. 이동 입력의 40/s 보충·80개 여유분과 ACK/seq 처리는 변경하지 않는다.
- 서버 기록은 최근 50개만 보관하고 재시작 시 비운다. 클라이언트도 50개만 보관한다. messageId 중복 제거 이력은 최대 200개다.
- 과거 기록은 React 채팅창으로만 전달한다. Scene은 실시간 `chat_message`만 받아 말풍선을 표시하므로 새로고침/Scene 구독 시 과거 말풍선을 재생하지 않는다.
- React 텍스트 자식과 Phaser Text만 사용한다. HTML 삽입 API를 사용하지 않으며 `<b>` 같은 입력도 문자 그대로 표시한다. 닉네임은 임시 표시 이름으로 인증 수단은 아니다.
- 정상 채팅 본문을 서버 로그나 진단 콘솔에 출력하지 않는다. 별도 IP 방화벽이나 로그인 기반 도배 방지까지 제공하는 구현은 아니다.

## UI·수명·이동

채팅창은 오른쪽 하단에 있으며 560px 이하의 새 화면에서는 기본 접힘 상태다. Enter로 펼치고 입력할 수 있다. 입력 중에는 WASD·방향키·E 이벤트가 Phaser로 전파되지 않으며 Scene에서도 텍스트 포커스를 확인한다. 포커스 진입·해제 시 키 상태와 이동 입력을 초기화해 눌린 키가 남지 않게 한다. 한글 조합 중 Enter는 전송으로 사용하지 않는다.

새 메시지는 맨 아래를 보고 있을 때만 자동 스크롤한다. 과거 내용을 읽을 때는 위치를 유지한다. 연결 대기 중에는 전송을 비활성화하되 현재 내역은 읽을 수 있다. 서버 재시작 후 빈 기록이 도착하면 이전 기록을 비운다.

GameCanvas의 빈 의존성 effect가 하나의 클라이언트를 생성하고 해제한다. 채팅 상태 변경은 Scene/소켓을 재생성하지 않는다. Scene은 구독만 소유하며 SHUTDOWN 시 구독·Physics 리스너·원격 캐릭터·말풍선만 정리한다. 게임 컴포넌트 해제 시에만 소켓과 타이머를 해제한다.

캐릭터별 말풍선은 하나만 유지한다. 새 메시지는 같은 Text/Graphics/Container를 갱신하고 만료 시각을 5초 뒤로 옮긴다. 별도 만료 타이머는 없다. 마지막 400ms는 페이드한다. 줄바꿈을 포함해 12줄을 넘으면 말풍선은 11줄과 말줄임표로 제한하고 React 내역에는 전체 내용을 보관한다. 이름표 위에 두되 위쪽 공간이 부족하면 발밑으로 옮겨 카메라 경계와 이름표를 피한다. 퇴장·재접속·Scene 종료 시 리소스를 정리한다. Container의 기본 exclusive 자식 파괴를 사용한다.

이동의 LocalReconciliation·공유 충돌 경계·POST_UPDATE 보정과 원격 보간은 유지했다. 채팅 수신은 위치 스냅샷 콜백이나 이동 sequence를 변경하지 않는다.

## 실제 검증

로컬 Java 17에서 Maven 전체 테스트, 프론트엔드 테스트/린트/TypeScript/Vite 빌드를 실행했다. 새 테스트는 채팅 50개 상한, 빈/150자/제어 문자/보조 평면 문자, 메시지 ID/서버 시각, 사칭·도배 거부, 512bytes를 넘는 정상 이모지 채팅, 50개 큰 기록 수신, 중복 제거, 과거 기록과 실시간 콜백 분리, 말풍선 재사용·경계·페이드·소멸, 입력 포커스와 이동 ACK 유지 등을 포함한다. 기존 이동 진동 재현 및 서버 이동 검증도 유지한다.

DB 없는 로컬 테스트 앱과 Vite를 사용해 실제 브라우저에서 확인한 항목:

- A/B 양방향 한글 전송, 발신자와 상대 화면의 동일 말풍선, 150자 줄바꿈, 약 5초 후 제거와 내역 유지.
- 태그가 일반 문자로 표시됨, Enter 입력/전송, ESC 취소, 전송 후 초기화, 접기/펼치기.
- 입력 중 d/e 키가 텍스트로만 들어가고 캐릭터가 정지함, ESC 이후 이동 복구, 컴퓨터 E와 연구 기록 패널/ESC 회귀.
- 새로고침 시 최근 기록 복원과 과거 말풍선 미재생, 닉네임/전송 시각 표시.
- 읽는 위치에서 scrollTop 0을 유지한 채 scrollHeight 280→330으로 증가. 하단에서는 scrollTop 140→190, scrollHeight 330→380으로 자동 추적.
- 390×844 화면에서 가로 넘침 없이 기본 접힘과 Enter 열기 확인. 모바일 가상 키보드 기기 테스트는 하지 않았다.
- 방문자 5명과 5개 말풍선을 표시하고 이동. 해당 로컬 진단 5초 구간에서 약 60 FPS, 역방향 이동 프레임 0, 강제 재동기화 0. 다양한 하드웨어/네트워크 전체에 대한 성능 보장은 아니다.
- 로컬 서버를 의도적으로 중지하자 입력/전송이 비활성화됨. 재시작 후 5명 자동 재접속, 빈 기록 반영, 새 채팅 전달 확인.

OS별 실제 IME 조합 키 시퀀스, 모바일 실기기 및 운영 테스트는 미검증이다. 코드의 composition/isComposing/keyCode 229 방어와 일반 한글 텍스트 입력을 동일한 검증으로 표현하지 않는다.

로컬 Docker 실행 도구가 없어 이미지 빌드는 PR CI에서 확인한다. 기존 CI/CD·인프라 설정을 변경하지 않는다. CI 통과 후 PR을 main에 병합하며 운영 SSH/수동 deploy/운영 DB 변경/배포 워크플로 수동 실행 및 운영 최종 테스트는 하지 않는다.
