/**
 * 폰 홈 화면 앱 목록. memberOnly 앱은 로그인한 연구원만 연다(서버도 401로 막는다).
 */
export type PhoneAppId = 'fish' | 'bank' | 'calendar' | 'browser' | 'sns' | 'furniture'
export type PhoneApp = { id: PhoneAppId; name: string; icon: string; memberOnly: boolean }

export const PHONE_APPS: readonly PhoneApp[] = [
  { id: 'fish', name: '물고기 보관함', icon: '🐟', memberOnly: true },
  { id: 'bank', name: '슬개 은행', icon: '🏦', memberOnly: true },
  { id: 'calendar', name: '캘린더', icon: '📅', memberOnly: true },
  { id: 'browser', name: '브라우저', icon: '🌐', memberOnly: false },
  { id: 'sns', name: '슬개그램', icon: '💬', memberOnly: false },
  { id: 'furniture', name: '가구점', icon: '🛋️', memberOnly: true },
]
