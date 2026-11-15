type InteractionArea = { x: number; y: number; width: number; height: number }
type NearbyPlayer = { id: string; nickname: string; x: number; y: number }

export function nearestPlayer(x: number, y: number, players: NearbyPlayer[], selfId: string | null, range: number) {
  if (!selfId) return null
  return players.filter(player => player.id !== selfId && Math.hypot(player.x - x, player.y - y) <= range)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) || a.id.localeCompare(b.id))[0] ?? null
}

export function hasTextInputFocus() {
  const active = document.activeElement
  return !!active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
    || active instanceof HTMLElement && active.isContentEditable)
}

// 오브젝트 중심이 아닌 가장 가까운 가장자리까지의 거리로 판정한다.
export function isNearObject(x: number, y: number, area: InteractionArea, range: number) {
  const dx = Math.max(Math.abs(x - area.x) - area.width / 2, 0)
  const dy = Math.max(Math.abs(y - area.y) - area.height / 2, 0)
  return Math.hypot(dx, dy) <= range
}
