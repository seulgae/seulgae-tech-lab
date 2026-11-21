/** 교환 결과 안내 */
export function tradeMessage(status: string, reason?: string) {
  if (status === 'accepted') return '교환했어요! 가방을 확인해 보세요.'
  if (status === 'declined') return '상대가 교환을 거절했어요.'
  const reasons: Record<string, string> = {
    login: '교환은 로그인한 연구원만 할 수 있어요.', partner_login: '상대가 로그인하지 않아 교환할 수 없어요.', partner: '상대가 회의실에 없어요.',
    item: '아이템이 이미 바뀌었어요. 가방을 다시 확인해 주세요.', sent: '이미 보낸 교환 신청이 있어요. 답을 기다려 주세요.',
    busy: '상대가 다른 교환을 보고 있어요. 잠시 후 다시 신청해 주세요.', self: '나에게는 교환을 신청할 수 없어요.',
    expired: '교환 신청이 만료됐어요(60초).', left: '상대가 회의실을 나가 교환이 취소됐어요.',
  }
  return reasons[reason ?? ''] ?? '교환하지 못했어요.'
}
