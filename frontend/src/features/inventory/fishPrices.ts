/**
 * 포장마차 물고기 값(서버 InventoryService.fishPrice와 같은 규칙). 화면에 미리 보여 주는 값이고, 실제 값은 서버가 정한다.
 * 어종의 최소~최대 값 사이를 크기(cm)에 비례해 반올림하며, 어떤 경우에도 1~30원이다.
 */
export const FISH_PRICE_MAX = 30
const SIZES: Record<string, readonly [number, number]> = {
  피라미: [8, 15], 붕어: [15, 32], 쏘가리: [20, 42], 메기: [30, 65], 무지개송어: [28, 55], '황금 잉어': [45, 90],
}
export const FISH_PRICES: Record<string, readonly [number, number]> = {
  피라미: [1, 3], 붕어: [2, 6], 쏘가리: [4, 10], 메기: [6, 14], 무지개송어: [8, 16], '황금 잉어': [15, 30],
}

export function fishPrice(species: string, cm: number | null) {
  const price = FISH_PRICES[species], size = SIZES[species]
  if (!price || !size || cm === null) return 0
  const ratio = Math.max(0, Math.min(1, (cm - size[0]) / (size[1] - size[0])))
  // 서버(Java Math.round)와 같게: 0.5는 올린다.
  const value = Math.floor(price[0] + ratio * (price[1] - price[0]) + 0.5)
  return Math.max(1, Math.min(FISH_PRICE_MAX, value))
}
