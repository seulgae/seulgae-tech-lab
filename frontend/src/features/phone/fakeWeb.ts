import { FISH_PRICES } from '../inventory/fishPrices.ts'
import { seoulNow } from './phoneTime.ts'

/**
 * 폰 웹 브라우저의 "게임 속 가짜 인터넷". 진짜 인터넷에는 나가지 않고, 연구소 안에서만 보이는 사이트를 그린다.
 * 사이트는 제목과 단락(heading/text/list/link) 블록으로 되어 있다. link는 다른 가짜 주소로 이동한다.
 */
export type WebBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'link'; text: string; href: string }
export type WebPage = { address: string; title: string; theme: string; blocks: WebBlock[] }

export const HOME_ADDRESS = 'portal.lab'

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
      { type: 'list', items: ['왼쪽 위: 개발 연구실', '오른쪽 위: 실습 연구실, 오른쪽 아래: 개인 기숙사', '왼쪽 아래: 오락실', '아래 가운데: 바깥(강가·포장마차)'] },
      { type: 'heading', text: '개발 연구실에서 갈 수 있는 곳' },
      { type: 'list', items: ['왼쪽 위: 서비스 연구실(업무 게시판)', '오른쪽 위: 관리자실(관리자만)', '왼쪽 아래: 서버실', '오른쪽 아래: 회의실(채팅·교환)'] },
      { type: 'heading', text: '알아 두면 좋은 것' },
      { type: 'list', items: ['E: 말 걸기·사용하기', 'I: 폰 열기', '로비 데스크: 케이크(HP +10)·커피(기력 +5)', '회의실: 다른 연구원과 채팅·교환'] },
      { type: 'link', text: '← 포털로', href: HOME_ADDRESS },
    ],
  }),
}

/** 주소의 가짜 사이트. 없는 주소면 "찾을 수 없음" 페이지 */
export function openSite(input: string, hour = seoulNow().hour): WebPage {
  const address = normalizeAddress(input)
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

export const SITE_ADDRESSES = Object.keys(SITES)
