# 카카오 로그인·회원가입

> 작성: 2026-11-17 · DB 스키마 V3 필요

## 동작

- **켜지는 조건**: 카카오 REST API 키, Redirect URI, 세션 서명 비밀값(32자 이상)이 모두 설정돼 있을 때만 로그인이 켜진다. 하나라도 없으면 로그인 버튼이 숨겨지고, 글쓰기는 기존처럼 누구나(수정 키 방식) 할 수 있다.
- **로그인 범위**: 연구소 둘러보기·이동·채팅은 로그인 없이 그대로다. **회의 안건·연구 아이디어 일지의 작성·수정·삭제만** 로그인이 필요하다.
- **회원가입**: 처음 카카오 로그인하면 회원이 만들어진다. 카카오 닉네임에서 허용하지 않는 문자를 뺀 값을 기본 닉네임으로 쓰고, 돌아오면 닉네임 확인 창이 열린다. 닉네임은 로비 이름표와 같은 규칙(1~16자, 글자·숫자·_·-)이다.
- **게임 이름표**: 로그인하면 이름표가 회원 닉네임으로 바뀐다(다음 접속부터).
- **글 소유**:
  - 로그인 회원이 쓴 글은 작성자 본인만 수정·삭제할 수 있다.
  - 로그인 전에 쓴 글은 그 글을 쓴 브라우저의 수정 키로 계속 고칠 수 있다.
  - 로그인이 켜진 뒤에는 수정·삭제도 로그인이 필요하다.
- **카카오톡 채널(플러스친구)**: 이 작업 범위가 아니다. 사용자가 직접 진행한다.

## 구현

| 파일 | 내용 |
|---|---|
| `backend/src/main/resources/db/migration/V3__members.sql` | `lab.members`(카카오 회원번호·닉네임), 안건·연구 기록에 `author_id` |
| `backend/.../auth/AuthSettings.java` | `lab.auth.*` 설정과 켜짐 조건 |
| `backend/.../auth/KakaoClient.java` | 인가 주소, 토큰 교환, `/v2/user/me` 조회 |
| `backend/.../auth/SessionCookies.java` | HMAC-SHA256 서명 세션 쿠키(`lab_session`, 14일). 서버 메모리 없이 재배포 후에도 유지 |
| `backend/.../auth/AuthService.java` | 로그인(첫 로그인 시 가입), 현재 회원, 글쓰기 권한(`writer`: 켜져 있으면 401, 꺼져 있으면 익명 허용), 닉네임 변경 |
| `backend/.../auth/AuthController.java` | `GET /api/auth/me`, `GET /api/auth/me/owned`, `PUT /api/auth/me/nickname`, `GET /api/auth/kakao/login`, `GET /api/auth/kakao/callback`, `POST /api/auth/logout` |
| `backend/.../common/write/Ownership.java` | 작성 회원 또는 수정 키로 소유 확인 |
| `frontend/src/features/auth/*` | 로그인 상태 저장소(`useAuth`, `canWrite`, `isMine`), 헤더 로그인 바, 닉네임 확인 창 |

### 보안

- **state 검증**: 인가 요청의 `state`를 10분짜리 HttpOnly 쿠키에 두고, 콜백에서 같은 값인지 확인한다(로그인 CSRF 방지).
- **세션 쿠키**: `HttpOnly`, `SameSite=Lax`, 기본 `Secure`이다. 다른 사이트에서 보낸 POST·PUT·DELETE에는 쿠키가 실리지 않는다.
- **저장 정보**: 카카오 액세스 토큰은 사용자 정보를 읽은 뒤 버리고 저장하지 않는다. 회원 테이블에는 카카오 회원번호와 닉네임만 둔다.
- **공개 정보**: 회원번호는 응답에 내보내지 않는다. 화면에는 회원 ID(UUID)와 닉네임만 보인다.
- **기존 보호 유지**: 작성 횟수 제한(`WriteRateLimiter`)과 입력 검증은 그대로 적용된다.

## 카카오 개발자 콘솔 설정 (사용자 진행)

1. [Kakao Developers](https://developers.kakao.com)에서 애플리케이션을 만든다.
2. **플랫폼 > Web**에 사이트 도메인(공개 주소, 로컬 시험 시 `http://localhost:5188`)을 등록한다.
3. **카카오 로그인**을 활성화하고 **Redirect URI**를 등록한다.
   - 운영: `https://<공개 주소>/api/auth/kakao/callback`
   - 로컬(Vite 프록시): `http://localhost:5188/api/auth/kakao/callback`
4. **동의항목**에서 `닉네임(profile_nickname)`을 필수 또는 선택으로 설정한다. 다른 개인정보는 요청하지 않는다.
5. **보안 > Client Secret**을 쓰려면 코드 생성 후 "사용함"으로 둔다(선택).
6. **앱 키**의 **REST API 키**를 확인한다.

## 서버 설정 값

| 속성 | 환경변수 | 비밀 여부 | 값 |
|---|---|---|---|
| `lab.auth.kakao.client-id` | `LAB_AUTH_KAKAO_CLIENT_ID` | 아님 | REST API 키 |
| `lab.auth.kakao.redirect-uri` | `LAB_AUTH_KAKAO_REDIRECT_URI` | 아님 | 위에서 등록한 Redirect URI와 정확히 같은 값 |
| `lab.auth.kakao.client-secret` | `LAB_AUTH_KAKAO_CLIENT_SECRET` | **비밀** | Client Secret(사용할 때만) |
| `lab.auth.session-secret` | `LAB_AUTH_SESSION_SECRET` | **비밀** | 32자 이상 임의 문자열(예: `openssl rand -base64 48`). 바꾸면 모든 로그인이 풀린다 |
| `lab.auth.cookie-secure` | `LAB_AUTH_COOKIE_SECURE` | 아님 | 기본 `true`. http로 접속하는 로컬 시험에서만 `false` |

- **운영**: 백엔드는 이미 `SPRING_CONFIG_IMPORT=configtree:/run/secrets/`를 쓴다. 비밀 값은 Compose secret의 **target 이름을 속성 이름으로**(예: `lab.auth.session-secret`, `lab.auth.kakao.client-secret`) 마운트하면 그대로 읽힌다. 비밀이 아닌 두 값은 Compose `environment`에 넣는다.
- **compose.yml**: 키가 아직 없어 이 PR에서는 바꾸지 않았다. 키를 받은 뒤 사용자가 추가한다. 추가 전까지 운영은 로그인이 꺼진 채(현재와 같은 동작)로 돈다.
- **로컬**: 위 환경변수를 넣고 백엔드를 실행한 뒤, Vite(5188)로 접속해 "카카오 로그인"을 누른다.

## 검증

- **백엔드 `AuthTest`**: 세션 쿠키 서명·만료·위조·ID 바꿔치기, 켜짐 조건, 첫 로그인 가입과 재로그인, 키가 없을 때 익명 허용과 키가 있을 때 401·회원 허용, 닉네임 규칙.
- **백엔드 `BoardServicesTest`**: 로그인 작성자는 수정 키 없이 수정, 다른 회원은 403, 기존 수정 키 글 유지.
- **CI PostgreSQL 통합 검사**: V3 적용 후 키가 없는 환경에서 `GET /api/auth/me` = `{kakaoEnabled:false, member:null}`, 로그인 주소 404.
- **프런트엔드 `auth.test.mjs`**: 쓰기 가능 판단, 로그인·내 글 읽기·로그아웃, 실패 시 비로그인 동작, 기존 수정 키 글 유지, 닉네임 규칙.
- **확인하지 못한 것**: 실제 카카오 로그인 왕복. 카카오 앱 키가 아직 없다.
