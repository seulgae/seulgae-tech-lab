type InteractionArea = { x: number; y: number; width: number; height: number }
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

/**
 * 두 상호작용 대상 중 플레이어에서 가장자리까지 더 가까운 쪽(같으면 첫째, 하나만 있으면 그것).
 *
 * @param x 플레이어 x
 * @param y 플레이어 y
 * @param first 첫째 대상(움직이는 대상)
 * @param second 둘째 대상(고정 대상)
 * @returns 고른 대상
 */
export function closerTarget<T extends InteractionArea>(x: number, y: number, first: T | undefined, second: T | undefined): T | undefined {
  if (!first || !second) return first ?? second
  const gap = (area: InteractionArea) => Math.hypot(Math.max(Math.abs(x - area.x) - area.width / 2, 0), Math.max(Math.abs(y - area.y) - area.height / 2, 0))
  return gap(second) < gap(first) ? second : first
}
