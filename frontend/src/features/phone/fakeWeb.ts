import { FISH_PRICES } from '../inventory/fishPrices.ts'
import { seoulNow } from './phoneTime.ts'
import { costText, gainText, rulesStore, ruleValue } from '../rules/rulesStore.ts'
import type { GameRules } from '../rules/rulesStore.ts'

/**
 * 폰 웹 브라우저의 "게임 속 가짜 인터넷". 진짜 인터넷에는 나가지 않고, 연구소 안에서만 보이는 사이트를 그린다.
 * 사이트는 제목과 단락(heading/text/list/table/link) 블록으로 되어 있다. link는 다른 가짜 주소로 이동한다.
 * 생활 가이드(guide.lab)는 서버 게임 규칙(/api/rules)으로 그때그때 만든다.
 */
export type WebBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'link'; text: string; href: string }
export type WebPage = { address: string; title: string; theme: string; blocks: WebBlock[] }

export const HOME_ADDRESS = 'portal.lab'
export const GUIDE_ADDRESS = 'guide.lab'

/** 주소창 글자를 사이트 주소로 다듬는다: 공백·http(s)://·www.·끝의 / 제거, 소문자 */
export function normalizeAddress(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || HOME_ADDRESS
}

/** 시각(한국 시간)으로 정하는 연구소 날씨. 같은 시간대에는 늘 같은 답이다. */
export function labWeather(hour: number) {
  if (hour >= 18) return { sky: '노을 뒤 밤하늘', temp: 14, tip: '포장마차가 문을 열었어요. 물고기를 팔아 봐요!' }
  if (hour >= 12) return { sky: '맑은 오후', temp: 21, tip: '낚시하기 좋은 날씨예요.' }
  if (hour >= 6) return { sky: '선선한 아침', temp: 16, tip: '커피 한 잔으로 기력을 채우고 출근해요.' }
  return { sky: '고요한 새벽', temp: 9, tip: '새벽에는 황금 잉어가 나온다는 소문이…?' }
}

const SITES: Record<string, (hour: number) => Omit<WebPage, 'address'>> = {
  'portal.lab': () => ({
    title: '슬개 포털', theme: 'portal', blocks: [
      { type: 'heading', text: '연구소 안 인터넷에 오신 걸 환영해요' },
      { type: 'text', text: '바깥 인터넷과는 이어지지 않은, 연구원 전용 사이트들이에요.' },
      { type: 'link', text: '📰 연구소 뉴스', href: 'news.lab' },
      { type: 'link', text: '🌤 오늘의 날씨', href: 'weather.lab' },
      { type: 'link', text: '🐟 물고기 도감', href: 'fish.wiki' },
      { type: 'link', text: '🗺 연구소 길 안내', href: 'help.lab' },
      { type: 'link', text: '📘 연구소 생활 가이드(HP·기력·직급)', href: GUIDE_ADDRESS },
    ],
  }),
  'news.lab': () => ({
    title: '연구소 뉴스', theme: 'news', blocks: [
      { type: 'heading', text: '[단독] 괴짜 박사님, 빌드 성공에 또 웃음' },
      { type: 'text', text: '개발 연구실의 박사님이 오늘도 CI 결과에 따라 울고 웃었다. 동료들은 "초록불이면 하루가 평화롭다"고 전했다.' },
      { type: 'heading', text: '저녁 6시, 강가 포장마차 개장' },
      { type: 'text', text: '바깥 길 위 포장마차가 저녁마다 문을 연다. 잡은 물고기는 크기와 어종에 따라 최대 30원에 팔 수 있다.' },
      { type: 'heading', text: '관리자실, 개발 연구실로 이사' },
      { type: 'text', text: '관리자실이 개발 연구실 오른쪽 위로 옮겼다. 문 앞 작은 컴퓨터에서 관리자 신청을 할 수 있다.' },
      { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
    ],
  }),
  'weather.lab': hour => {
    const weather = labWeather(hour)
    return {
      title: '연구소 날씨', theme: 'weather', blocks: [
        { type: 'heading', text: `지금은 ${weather.sky}, ${weather.temp}℃` },
        { type: 'text', text: weather.tip },
        { type: 'list', items: ['아침 6시: 선선', '낮 12시: 맑음', '저녁 6시: 노을과 밤', '새벽: 고요'] },
        { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
      ],
    }
  },
  'fish.wiki': () => ({
    title: '물고기 도감', theme: 'wiki', blocks: [
      { type: 'heading', text: '강가 데크에서 잡히는 물고기' },
      { type: 'text', text: '포장마차 값은 어종의 최소~최대 값 사이에서 크기에 비례해요. 한 마리 최대 30원.' },
      { type: 'list', items: Object.entries(FISH_PRICES).map(([name, [min, max]]) => `${name}: ${min}~${max}원`) },
      { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
    ],
  }),
  'help.lab': () => ({
    title: '연구소 길 안내', theme: 'help', blocks: [
      { type: 'heading', text: '로비에서 갈 수 있는 곳' },
      { type: 'list', items: ['왼쪽 위: 개발 연구실', '오른쪽 위: 협동 연구실, 오른쪽 아래: 개인 기숙사', '왼쪽 아래: 오락 연구실', '아래 가운데: 바깥(강가·포장마차)'] },
      { type: 'heading', text: '개발 연구실에서 갈 수 있는 곳' },
      { type: 'list', items: ['왼쪽 위: 서비스 연구실(업무 게시판)', '오른쪽 위: 관리자실(관리자만)', '왼쪽 아래: 서버실', '오른쪽 아래: 회의실(채팅·교환)'] },
      { type: 'heading', text: '알아 두면 좋은 것' },
      { type: 'list', items: ['E: 말 걸기·사용하기', 'I: 폰 열기', 'HP·기력·직급 규칙: 생활 가이드(guide.lab)', '회의실: 다른 연구원과 채팅·교환'] },
      { type: 'link', text: '📘 연구소 생활 가이드', href: GUIDE_ADDRESS },
      { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
    ],
  }),
}

/**
 * 연구소 생활 가이드: HP·기력이 드는 행동, 회복 방법, 직급별 급여·최대치, 하루 한도. 숫자는 모두 지금 게임 규칙에서 온다.
 *
 * @param rules 게임 규칙
 * @returns 페이지 블록
 */
export function guideBlocks(rules: GameRules): WebBlock[] {
  const lobby = rules.snacks.filter(snack => snack.place === 'LOBBY'), vending = rules.snacks.filter(snack => snack.place === 'VENDING')
  const top = rules.ranks.find(rank => rank.unlimited)
  return [
    { type: 'heading', text: 'HP·기력이 드는 행동' },
    { type: 'text', text: '모자라면 그 행동을 할 수 없어요. 직급이 오르면 최대치가 커져 더 많이 할 수 있어요.' },
    { type: 'table', head: ['행동', '드는 값', '어디서'], rows: rules.actions.map(action => [action.name, costText(action.code, rules), action.description]) },
    { type: 'heading', text: '회복하는 법' },
    { type: 'table', head: ['회복', '값', '효과'], rows: [
      ...lobby.map(snack => [`로비 데스크 ${snack.name}`, `${snack.price}원`, gainText(snack)]),
      ...vending.map(snack => [`자판기 ${snack.name}`, `${snack.price}원`, gainText(snack)]),
      ['기숙사 침대에서 쉬기', '무료', `${ruleValue('REST_EVERY_SEC', rules)}초마다 HP +${ruleValue('REST_HP', rules)} · 기력 +${ruleValue('REST_FATIGUE', rules)}`],
    ] },
    { type: 'text', text: '회복할 게 없으면(가득 차 있으면) 동전을 받지 않아요. 침대는 폰 가구점에서 사서 개인 기숙사에 놓아요.' },
    { type: 'heading', text: '직급과 급여' },
    { type: 'text', text: '내 자리 컴퓨터에서 오늘 업무 보상을 받은 날 수(누적 일 완료)로 직급이 정해져요. 접속해 있으면 10분마다 급여가 들어와요.' },
    { type: 'table', head: ['직급', '누적 일', '10분 급여', 'HP·기력 최대'], rows: rules.ranks.map(rank => [rank.name, `${rank.minWork}일`, `${rank.pay}원`, rank.unlimited ? '무제한' : String(rank.vitalsMax)]) },
    ...(top ? [{ type: 'text' as const, text: `${top.name}은(는) HP·기력이 줄지 않아요.` }] : []),
    { type: 'heading', text: '하루 한도(자정에 초기화)' },
    { type: 'list', items: ['오락실 메인 오락기: 하루 5판', '오락실 내기: 하루 5판', '게시물 보상: 하루 10번', '자바 연습 보상: 하루 3번', '주식 거래: 하루 30번'] },
    { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
  ]
}

/** 주소의 가짜 사이트. 없는 주소면 "찾을 수 없음" 페이지 */
export function openSite(input: string, hour = seoulNow().hour): WebPage {
  const address = normalizeAddress(input)
  if (address === GUIDE_ADDRESS) return { address, title: '연구소 생활 가이드', theme: 'guide', blocks: guideBlocks(rulesStore.get()) }
  const site = SITES[address]
  if (site) return { address, ...site(hour) }
  return {
    address, title: '페이지를 찾을 수 없어요', theme: 'missing', blocks: [
      { type: 'heading', text: `${address} 는 연구소 인터넷에 없어요` },
      { type: 'text', text: '이 브라우저는 연구소 안 사이트만 열어요.' },
      { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
    ],
  }
}

export const SITE_ADDRESSES = [...Object.keys(SITES), GUIDE_ADDRESS]
