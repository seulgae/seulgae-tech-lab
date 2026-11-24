import type { TechBook } from './techBooks'

/**
 * 관리자실 책장의 운영 도서관. 어떤 테이블에서 무엇을 관리할 수 있는지, 고치는 쿼리와 주의할 점을 표로 적었다.
 * 관리자실 가운데 슈퍼컴퓨터(쿼리 콘솔)에서 그대로 따라 할 수 있게 쓴다. 정적 데이터라 서버 호출이 없다.
 *
 * @author 길태형
 * @version 1.1, 새 행동 비용·침대 휴식(V24)
 * @see "None"
 */
export const ADMIN_BOOKS: readonly TechBook[] = [
  {
    id: 'admin-map', title: '운영 지도', subtitle: '어떤 테이블에서 무엇을 바꿀 수 있나', color: '#c9a24b',
    pages: [
      { heading: '이 책장 사용법', body: [
        '관리자실 가운데 슈퍼컴퓨터에서 E를 누르면 쿼리 콘솔이 열려요. 이 책의 쿼리를 그대로 붙여 넣어 실행하면 돼요.',
        '바꾸는 쿼리(UPDATE·INSERT·DELETE)는 실행 전에 한 번 더 확인해요. 먼저 SELECT로 지금 값을 보고 고쳐요.',
      ] },
      { heading: '바로 반영되는 규칙 테이블', body: ['게임 규칙(V23)은 서버가 1분마다 다시 읽어요. 고친 뒤 최대 1분 안에 모든 연구원에게 적용돼요.'], table: {
        head: ['테이블', '관리하는 것', '반영'],
        rows: [
          ['tb_lab_action_cost', '행동별 HP·기력 비용(글쓰기, QA, 오락실)', '1분 안'],
          ['tb_lab_snack', '간식·음료 가격과 회복량, 파는 곳', '1분 안'],
          ['tb_lab_rank', '직급 기준·10분 급여·HP·기력 최대치', '1분 안'],
          ['tb_lab_game_rule', '숫자 규칙(침대 휴식 간격·회복량 등)', '1분 안'],
        ],
      } },
      { heading: '그 밖에 운영자가 고칠 수 있는 테이블', body: ['아래 테이블은 서버가 요청 때마다 읽어서 고치면 바로 반영돼요.'], table: {
        head: ['테이블', '관리하는 것', '반영'],
        rows: [
          ['tb_lab_furniture', '폰 가구점 가구 이름·가격·크기', '바로'],
          ['tb_lab_stock', '주식 종목 이름·소개·등락폭', '다음 시세 때'],
          ['tb_lab_common_code', '화면 표시 이름(동전 사유·상태 등)', '바로'],
          ['tb_lab_member', '회원 닉네임·등급(1 일반, 2 운영자, 3 관리자)', '다시 로그인'],
          ['tb_lab_member_inventory', '회원 동전·HP·기력·누적 일 수', '바로'],
        ],
      } },
      { heading: '고치지 말아야 할 테이블', body: ['기록 테이블은 사실 그대로 남겨야 해요. 잘못 고치면 은행 내역·하루 한도 계산이 틀어져요.'], table: {
        head: ['테이블', '이유'],
        rows: [
          ['tb_lab_coin_history', '동전 거래 내역과 하루 보상·송금 한도 계산 근거'],
          ['tb_lab_savings', '적금 원금·만기·지급액(지급 기록)'],
          ['tb_lab_stock_price', '시세 그래프 기록'],
          ['tb_lab_level_request', '등급 신청 처리 기록(관리자 화면에서 처리)'],
        ],
      } },
    ],
  },
  {
    id: 'admin-action-cost', title: '행동 비용', subtitle: 'tb_lab_action_cost · HP·기력이 깎이는 행동', color: '#e05a6c',
    pages: [
      { heading: '하는 일', body: [
        '일과 오락 한 번에 드는 HP·기력이에요. 모자라면 서버가 행동을 막고(423), 하면 그만큼 빼요.',
        '연구소장(무제한 직급)은 빼지 않아요. 비용을 0·0으로 두면 그 행동은 HP·기력 없이 할 수 있어요.',
      ] },
      { heading: '열', body: [], table: {
        head: ['열', '뜻', '값'],
        rows: [
          ['code', '행동 코드(서버 코드와 연결, 바꾸지 않음)', '대문자'],
          ['name', '화면 이름', '1~30자'],
          ['hp_cost', '한 번에 빼는 HP', '0~999'],
          ['fatigue_cost', '한 번에 빼는 기력', '0~999'],
          ['description', '어디서 하는 행동인지', '설명'],
          ['sort_order', '목록 순서', '숫자'],
        ],
      } },
      { heading: '지금 있는 행동', body: ['코드는 서버가 직접 찾기 때문에 새 코드를 넣어도 저절로 쓰이지 않아요. 새 행동은 개발이 필요해요.'], table: {
        head: ['code', '행동', '기본 HP', '기본 기력'],
        rows: [
          ['IDEA_POST', '아이디어 글 올리기', '3', '5'],
          ['QA_REGISTER', 'QA 티켓 등록', '3', '5'],
          ['QA_MOVE', 'QA 단계 변경(조치 중·완료)', '3', '5'],
          ['ARCADE_PLAY', '오락실 한 판', '3', '5'],
          ['GAMBLE_BET', '오락실 내기 한 판', '0', '3'],
          ['FISH_CATCH', '물고기 낚기(보관함에 넣을 때)', '0', '4'],
          ['JAVA_ANSWER', '자바 연습 답 제출', '0', '2'],
          ['STOCK_TRADE', '주식 사기·팔기', '0', '1'],
          ['FURNITURE_PLACE', '기숙사 가구 놓기', '2', '0'],
        ],
      } },
      { heading: '고치는 예', body: ['오락실을 기력 3만 들게(HP는 안 듦):'], code: "UPDATE lab.tb_lab_action_cost\n   SET hp_cost = 0, fatigue_cost = 3\n WHERE code = 'ARCADE_PLAY';" },
      { heading: '주의', body: [
        '행을 지우면 그 행동은 비용 0이 돼요(막히지 않음). 잠깐 무료로 풀 때만 지우고, 보통은 UPDATE로 고쳐요.',
        '화면 문구(“HP -3, 기력 -5”)도 이 값을 읽어 바뀌어요. 연구원은 새로고침하면 바로 보여요.',
      ] },
    ],
  },
  {
    id: 'admin-snack', title: '간식과 음료', subtitle: 'tb_lab_snack · 가격과 회복량', color: '#6fae6a',
    pages: [
      { heading: '하는 일', body: [
        '로비 데스크(케이크·커피)와 자판기 음료의 가격·회복량이에요. 사면 바로 먹고 그만큼 회복해요.',
        '회복할 것이 모두 가득하면 동전을 받지 않아요(422).',
      ] },
      { heading: '열', body: [], table: {
        head: ['열', '뜻', '값'],
        rows: [
          ['code', '간식 코드', '대문자'],
          ['name', '화면 이름', '1~30자'],
          ['price', '가격(동전)', '1~999'],
          ['hp_gain', 'HP 회복량', '0~999'],
          ['fatigue_gain', '기력 회복량', '0~999'],
          ['place', 'LOBBY 데스크 / VENDING 자판기', '둘 중 하나'],
          ['sort_order', '자판기 버튼 순서', '숫자'],
        ],
      } },
      { heading: '기본값', body: [], table: {
        head: ['code', '이름', '가격', 'HP', '기력', '곳'],
        rows: [
          ['CAKE', '케이크', '3', '+10', '0', 'LOBBY'],
          ['COFFEE', '커피', '2', '0', '+5', 'LOBBY'],
          ['COLA', '콜라', '2', '0', '+5', 'VENDING'],
          ['CIDER', '사이다', '2', '0', '+5', 'VENDING'],
          ['FANTA', '환타', '2', '0', '+5', 'VENDING'],
          ['WATER', '물', '1', '0', '+2', 'VENDING'],
          ['LUNCHBOX', '도시락', '6', '+25', '0', 'VENDING'],
          ['ENERGY_DRINK', '에너지드링크', '5', '0', '+20', 'VENDING'],
        ],
      } },
      { heading: '고치는 예', body: ['커피를 3원에 기력 +8로:'], code: "UPDATE lab.tb_lab_snack\n   SET price = 3, fatigue_gain = 8\n WHERE code = 'COFFEE';" },
      { heading: '자판기 음료 추가', body: [
        '자판기 창은 place = VENDING 행을 모두 버튼으로 보여 줘요. 새 음료는 거래 내역 이름도 함께 넣어요(코드가 COIN_REASON과 같아야 해요).',
      ], code: "INSERT INTO lab.tb_lab_common_code (code_group, code, name, sort_order)\nVALUES ('COIN_REASON', 'MILK', '우유', 90);\nINSERT INTO lab.tb_lab_snack (code, name, price, hp_gain, fatigue_gain, place, sort_order)\nVALUES ('MILK', '우유', 2, 2, 3, 'VENDING', 70);" },
      { heading: '주의', body: [
        'CAKE·COFFEE는 로비 데스크 소품과 연결된 코드라 지우지 말아요. 지우면 그 소품을 살 수 없어요.',
        'COIN_REASON에 없는 코드는 동전 이력 저장이 실패해 구매가 안 돼요. 꼭 공통코드를 먼저 넣어요.',
      ] },
    ],
  },
  {
    id: 'admin-rank', title: '직급표', subtitle: 'tb_lab_rank · 승진 기준·급여·최대치', color: '#5a8ccf',
    pages: [
      { heading: '하는 일', body: [
        '누적 일 완료 수(tb_lab_member_inventory.work_count)가 min_work 이상인 가장 높은 직급이 그 회원의 직급이에요.',
        '직급마다 10분 급여와 HP·기력 최대치가 달라요. unlimited 직급은 HP·기력이 줄지 않아요(화면에 ∞).',
      ] },
      { heading: '열', body: [], table: {
        head: ['열', '뜻', '값'],
        rows: [
          ['code', '직급 코드', '대문자'],
          ['name', '사원증·화면 이름', '1~20자'],
          ['min_work', '필요한 누적 일 완료 수(겹치면 안 됨)', '0 이상'],
          ['salary', '10분마다 받는 급여(동전)', '0~9999'],
          ['vitals_max', 'HP·기력 최대치', '1~999'],
          ['unlimited', 'HP·기력 무제한', 'true/false'],
          ['sort_order', '표시 순서', '숫자'],
        ],
      } },
      { heading: '기본값', body: [], table: {
        head: ['직급', '누적 일', '급여', '최대치', '무제한'],
        rows: [
          ['인턴', '0', '1', '50', ''],
          ['주임', '1', '5', '100', ''],
          ['선임', '5', '10', '150', ''],
          ['책임', '10', '20', '220', ''],
          ['수석', '30', '50', '500', ''],
          ['연구소장', '100', '100', '999', '예'],
        ],
      } },
      { heading: '고치는 예', body: ['선임 승진을 3일로 앞당기고 급여를 올리기:'], code: "UPDATE lab.tb_lab_rank\n   SET min_work = 3, salary = 12\n WHERE code = 'SENIOR';" },
      { heading: '주의', body: [
        'min_work = 0인 직급이 꼭 하나 있어야 해요. 없으면 서버가 표를 쓰지 않고 이전(또는 기본) 직급표를 그대로 써요.',
        'vitals_max는 승진하는 순간 회원 최대치로 들어가요(가득 채움). 이미 그 직급인 회원은 그대로라, 맞추려면 아래 쿼리를 함께 실행해요.',
      ], code: "UPDATE lab.tb_lab_member_inventory\n   SET hp_max = 150, fatigue_max = 150,\n       hp = LEAST(hp, 150), fatigue = LEAST(fatigue, 150)\n WHERE work_count >= 5 AND work_count < 10; -- 선임 구간" },
    ],
  },
  {
    id: 'admin-game-rule', title: '숫자 규칙', subtitle: 'tb_lab_game_rule · 키 → 값', color: '#4fb3a9',
    pages: [
      { heading: '하는 일', body: [
        '코드에 있던 숫자 규칙을 하나씩 옮겨 오는 표예요. 코드가 code로 값을 찾고, 표에 없으면 기본값을 써요.',
        '지금은 기숙사 침대 휴식 규칙이 들어 있어요. 폰 브라우저 생활 가이드(guide.lab)에도 이 값이 그대로 보여요.',
      ] },
      { heading: '열', body: [], table: {
        head: ['열', '뜻', '값'],
        rows: [
          ['code', '규칙 코드(바꾸지 않음)', '대문자'],
          ['name', '화면 이름', '1~40자'],
          ['value', '값(단위는 description)', '0~100000'],
          ['description', '단위와 뜻', '설명'],
          ['sort_order', '표시 순서', '숫자'],
        ],
      } },
      { heading: '지금 있는 규칙', body: [], table: {
        head: ['code', '뜻', '기본값'],
        rows: [
          ['REST_EVERY_SEC', '침대에서 회복하는 간격(초)', '60'],
          ['REST_HP', '한 번에 오르는 HP', '3'],
          ['REST_FATIGUE', '한 번에 오르는 기력', '3'],
        ],
      } },
      { heading: '고치는 예', body: ['침대 휴식을 30초마다 HP 5·기력 5로:'], code: "UPDATE lab.tb_lab_game_rule SET value = 30 WHERE code = 'REST_EVERY_SEC';\nUPDATE lab.tb_lab_game_rule SET value = 5 WHERE code IN ('REST_HP', 'REST_FATIGUE');" },
      { heading: '주의', body: [
        'REST_EVERY_SEC를 0으로 두면 서버가 1초로 바꿔 써요. 너무 짧으면 침대가 커피보다 좋아지니 균형을 봐요.',
        '휴식 간격은 회원마다 마지막 회복 시각(tb_lab_member_inventory.last_rest_at)으로 서버가 지켜요.',
      ] },
    ],
  },
  {
    id: 'admin-catalog', title: '상점과 종목', subtitle: '가구점·주식·공통코드·회원', color: '#a77bd1',
    pages: [
      { heading: 'tb_lab_furniture 가구점', body: ['code는 화면 그림과 연결돼 새 가구는 그림 개발이 필요해요. 가격·이름·순서는 바로 고쳐도 돼요.'], table: {
        head: ['열', '뜻'],
        rows: [['name', '가구 이름'], ['price', '가격(동전)'], ['width / height', '바닥 차지 크기(px), 충돌 판정'], ['blocking', '부딪히는지(러그는 false)'], ['sort_order', '가구점 순서']],
      }, code: "UPDATE lab.tb_lab_furniture SET price = 30 WHERE code = 'BED';" },
      { heading: 'tb_lab_stock 주식 종목', body: ['서버가 10분마다 등락폭 안에서 시세를 움직여요. 현재가를 직접 고치면 그래프가 튀니 등락폭만 고쳐요.'], table: {
        head: ['열', '뜻'],
        rows: [['name / summary', '회사 이름 / 한 줄 소개'], ['volatility_pct', '한 번에 최대 등락폭(%)'], ['price', '현재가(직접 수정 비추천)'], ['sort_order', '목록 순서']],
      } },
      { heading: 'tb_lab_common_code 공통코드', body: ['화면 표시 이름표예요. code_group으로 묶여 있어요. 이름만 고치고 code는 바꾸지 말아요.'], table: {
        head: ['code_group', '쓰는 곳'],
        rows: [['COIN_REASON', '은행 거래 내역 사유 이름(간식 코드와 같아야 함)'], ['REQUEST_STATUS', '등급 신청 상태'], ['그 밖', '게시판 상태·아이템 종류 등']],
      } },
      { heading: '회원 조정', body: ['문의로 동전·기력을 돌려줄 때만 써요. 동전은 이력과 맞춰야 하니 가급적 게임 안 기능으로 처리해요.'], table: {
        head: ['테이블.열', '뜻'],
        rows: [['tb_lab_member.level', '1 일반, 2 운영자, 3 관리자'], ['tb_lab_member_inventory.hp / fatigue', '현재 HP·기력(최대치 이하)'], ['tb_lab_member_inventory.work_count', '누적 일 완료 수(직급 계산)']],
      }, code: "UPDATE lab.tb_lab_member_inventory\n   SET fatigue = fatigue_max\n WHERE member_id = '회원 UUID';" },
    ],
  },
  {
    id: 'admin-constants', title: '코드 속 숫자', subtitle: '아직 테이블이 아닌 규칙(개발 필요)', color: '#8c8c8c',
    pages: [
      { heading: '왜 따로 적나', body: [
        '아래 숫자는 아직 서버 코드에 있어서 쿼리로 바꿀 수 없어요. 바꾸려면 개발 PR이 필요해요.',
        '자주 바꾸고 싶은 값이 생기면 다음 단계(tb_lab_game_rule 키-값 표)로 옮길 후보예요.',
      ] },
      { heading: '보상과 하루 한도', body: [], table: {
        head: ['규칙', '값', '위치'],
        rows: [
          ['게시물 보상', '10원, 하루 10번', 'InventoryService'],
          ['오늘 업무 보상', '5원(하루 한 번)', 'DeskService'],
          ['자바 문제 보상', '1원, 하루 3번', 'DeskService'],
          ['오락실 한 판', '1원, 하루 5판', 'InventoryService'],
          ['급여 간격', '10분', 'BadgeService'],
        ],
      } },
      { heading: '운과 돈', body: [], table: {
        head: ['규칙', '값', '위치'],
        rows: [
          ['화분 흔들기', '5% 확률 1~3원, 하루 10번', 'InventoryService'],
          ['홀짝 / 사다리', '1~20원, 하루 5판, 1.9배 / 2.8배', 'GambleService'],
          ['적금', '1일 3%, 3일 10%, 7일 25%, 최대 3건', 'SavingsService'],
          ['송금', '1~100원, 하루 10번', 'BankService'],
          ['주식', '10분마다 시세, 하루 30번 거래', 'StockService'],
          ['물고기 값', '최대 30원, 저녁 6시부터', 'InventoryService'],
        ],
      } },
    ],
  },
  {
    id: 'admin-procedure', title: '운영 수칙', subtitle: '고치기 전에 꼭 읽기', color: '#e7c66f',
    pages: [
      { heading: '순서', body: [], table: {
        head: ['단계', '할 일'],
        rows: [
          ['1. 보기', 'SELECT로 지금 값을 확인하고 메모해 둬요.'],
          ['2. 한 줄만', 'WHERE code = ... 로 한 행만 고쳐요. WHERE 없는 UPDATE는 금지.'],
          ['3. 확인', '다시 SELECT 하고, 1분 뒤 게임 화면(폰 앱·자판기)에서 숫자를 봐요.'],
          ['4. 기록', '무엇을 왜 바꿨는지 회의실 안건이나 개발 로그에 남겨요.'],
        ],
      } },
      { heading: '되돌리기', body: [
        '메모해 둔 예전 값으로 같은 UPDATE를 한 번 더 하면 돼요. 규칙 테이블은 기록이 아니라 설정이라 언제든 되돌릴 수 있어요.',
        '테이블 구조(열 추가·삭제)는 쿼리 콘솔에서 바꾸지 말아요. 구조 변경은 마이그레이션(Flyway)으로만 해요.',
      ] },
      { heading: '값이 이상할 때', body: [
        '규칙 테이블을 읽지 못하면 서버는 마지막으로 읽은 값(처음이면 기본값)을 계속 써요. 게임이 멈추지는 않아요.',
        '숫자 열은 제약이 있어 범위를 벗어나면 저장되지 않아요(예: 가격 0원, 최대치 1000, 회복량이 모두 0인 간식).',
      ] },
    ],
  },
]
