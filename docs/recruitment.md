# 채팅 분석 → 채용 접수 → NPC 검토·지원 관리

이 채팅에서 공고를 검색·분석해 정형 JSON 배열을 만든다. 서버는 검색엔진이나 GPT API를 호출하지 않는다.
Brave/OpenAI 토큰은 필요 없다. 접수 전용 토큰은 우리 서버에 정형 공고를 등록하는 인증정보다.

## 업무 흐름

1. 서치: 외부에서 들어온 정형 공고를 접수·중복 확인한다.
2. 체크: 근거와 Java 조건을 검증한다. 미확인 항목은 REVIEW이며 값을 만들어내지 않는다.
3. 로그: DB 반영, 지원/보류 내역 관리, 마감일 삭제와 보고를 담당한다.

개발 연구실 → 서비스 연구실의 아래쪽 NPC를 클릭하거나 E로 상세 패널을 연다.
관리자 등급 3으로 접수·근거 보완·읽음/확인/지원/보류 처리를 할 수 있다.
서버는 매분 수신함을 처리하고 마감일을 확인한다. 화면을 닫아도 실행된다.
기존 09/13/15/17시 외부 검색·키 대기 구조를 대체한다. 지연 접수·재시작 시에도 저장된 후보를 처리한다.

## 등록 제한

- 한국 날짜 기준 하루 최대 10건. 여러 번 나눠 등록해도 합산한다.
- 같은 기업 또는 출처+공고 ID 재등록을 거절한다. 기업명은 공백·전각·법인 표기를 정규화한다.
- 다른 기업명 별칭까지 자동으로 동일 법인임을 식별하지는 못한다. 분석 시 정식 기업명을 통일한다.
- 배치가 중복·한도에 걸리면 전체 롤백한다. 마감 삭제 후에도 최소 접수 원장을 유지해 한도를 복원하지 않는다.
- 10건을 채우려고 불확실한 사실을 만들어내지 않는다. 확인 가능한 공고만 최대 10건 등록한다.

## 읽음·확인·지원·보류

NEW → READ → CONFIRMED → APPLIED 또는 HOLD 순서다. HOLD → APPLIED도 가능하다.
읽음과 확인은 사용자가 명시적으로 눌러야 한다. NPC가 사용자가 읽거나 지원했다고 추측하지 않는다.
지원 완료는 직접 입사지원한 사실의 기록이며, 외부 지원서 제출 기능은 아니다.
각 상태 변경의 관리자 ID·시각·이전/이후 상태를 저장한다.

확인된 마감일이 지나면 공고 마스터·원본 연결·후보 원문·근거·공고 변경 이력을 물리 삭제한다.
NEW/READ/CONFIRMED 검토 기록도 삭제한다. APPLIED/HOLD는 독립 스냅샷으로 남겨 지원/보류 내역을 유지한다.
원장에는 기업 중복 키·원본 ID·등록 날짜만 남긴다. 기업정보는 공고 연결이 없으면 제거한다.
마감일 미확인은 임의 삭제하지 않는다. 날짜만 있을 때는 한국 날짜의 다음날 00시를 마감 기준으로 삼는다.
이 삭제 정책은 V12의 EXPIRED 보관 정책을 대체하며, 기존 V12의 마감 공고에도 적용된다.

## 적용 순서

V13 확장 PR 병합·12..13 릴리스 배포 확인 → 운영자 `python3 deploy/migrate-prod.py` → 기능 PR 병합 순서다.
기능 릴리스는 13..13을 요구한다. 운영 DB 마이그레이션·배포는 사용자가 실행한다.
모듈 기본값은 활성화다. 기존 recruitment.env에 LAB_RECRUITMENT_ENABLED=false가 있으면 true로 변경해야 한다.

## 등록 방법

관리자는 NPC 패널의 ‘정형 공고 접수’에 JSON을 붙여 넣을 수 있다. 토큰 없이 관리자 로그인으로 등록한다.
채팅에서 API로 등록하려면 서버의 비공개 recruitment.env에 다음 설정을 추가하고 컨테이너에 반영한다.

```dotenv
LAB_RECRUITMENT_ENABLED=true
LAB_RECRUITMENT_INTAKE_TOKEN=32자_이상의_독립적인_랜덤_토큰
```

설정 파일은 소유자만 읽도록 하고 Git·채팅에 토큰을 노출하지 않는다. 검색 API 토큰이나 DB 비밀번호를 재사용하지 않는다.
이 토큰은 정형 공고 등록만 허용한다. 지원 상태 변경·임의 SQL·다른 데이터 조회 권한은 없다.

이 PC에는 토큰을 비공개 파일에 저장한다. 별도 비공개 설정 JSON은 다음 구조다.

```json
{"baseUrl":"https://연구소주소","tokenFile":"토큰을_저장한_로컬_파일_절대경로"}
```

파일 경로만 채팅에 알려주면 등록 도구가 읽을 수 있다. 입력 JSON은 공고 배열이다.

```powershell
python deploy/import-recruitment.py --config <비공개설정경로> --input <공고JSON경로>
```

연결이 끊겨도 서버가 이미 등록했을 수 있다. 자동 재시도하지 않고 대시보드에서 먼저 확인한다.
등록 응답은 등록 건수·원장 ID·한국 날짜·오늘 남은 등록 가능 건수를 반환한다.
운영 DB에 직접 임의 INSERT하면 검증 흐름을 건너뛰므로 이 도구나 관리자 접수를 사용한다.

## 정형 공고 계약

필수: source(SARAMIN/JOBKOREA), externalId, url(해당 출처 HTTPS), company(정식 기업명), title, facts(객체).
선택: stack, career, region, summary, content. 전체 공고 JSON은 15,000자 이하로 제한한다.
facts의 각 항목은 value, url, quote(최대 1,000자), checkedAt(UTC ISO 시각)을 갖는다.
미확인 항목은 생략한다. checkedAt은 실제 확인 시각이며 미래 값·30일 이상 오래된 근거는 접수하지 않는다.

| 항목 | value 형식 | 조건 |
|---|---|---|
| javaBackend | boolean | true |
| companyType | SME/MID/LARGE/OTHER | SME |
| employees | 정수 | 100 이상 |
| rating | 0~5 숫자 | 2.5 이상, 잡플래닛 출처 |
| probationMonths | 정수 | 6 제외, 미기재 통과 금지 |
| accepting | boolean | true |
| deadline | YYYY-MM-DD 또는 UTC ISO | 확인된 마감일 |

## API·검증

- GET /api/recruitment/agents: 오늘의 최소 NPC 상태.
- GET /api/recruitment: 관리자 대시보드, 검토·지원·보류 스냅샷 포함.
- POST /api/recruitment/imports: 관리자 정형 공고 접수.
- POST /api/recruitment/intake: Authorization: Bearer 전용 토큰으로 접수.
- PATCH /api/recruitment/reviews/{id}: 관리자 state 변경.
- PUT /api/recruitment/collections/{id}/evidence: 관리자 근거 보완.
- POST /api/recruitment/jobs/{task}: 수동 정제·반영·정리. 같은 서비스와 DB 락을 사용한다.

CI의 일회용 PostgreSQL에서 배치 롤백·일일 한도·기업 중복·락·상태 순서·마감 삭제·지원 기록 보존을 검증한다.
운영 데이터로 시험용 등록·삭제하지 않는다. 실제 공고 분석은 실행을 요청받은 채팅 또는 별도로 설정한 오전 작업에서 수행한다.
이 변경은 오전 자동화를 새로 생성하거나 다른 채팅의 지시를 변경하지 않는다.
