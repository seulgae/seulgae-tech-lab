import { inventoryStore } from '../inventory/inventoryStore.ts'
import { tiredMessage } from '../rules/rulesStore.ts'
/**
 * 개인 기숙사 가구 API와 배치 규칙.
 * 규칙(벽 안쪽, 문 앞 비우기, 부딪히는 가구끼리 겹치지 않기)은 서버 DormServiceImpl과 같다. 화면은 미리 보여 주기만 하고 판정은 서버가 한다.
 *
 * @author 길태형
 * @version 1.0, 개인 기숙사 가구
 * @see "None"
 */
export type Furniture = { code: string; name: string; price: number; width: number; height: number; blocking: boolean }
export type OwnedFurniture = { id: string; code: string; placed: boolean; x: number | null; y: number | null }
export type DormView = { coins: number; catalog: Furniture[]; furniture: OwnedFurniture[] }

/** 배치 시작(폰 → 게임 장면). detail: 가구 ID */
export const DORM_PLACE_EVENT = 'lab:dorm-place'
/** 가구가 바뀜(구매·배치·보관 뒤 장면이 다시 읽는다) */
export const DORM_CHANGED_EVENT = 'lab:dorm-changed'

/* 배치를 기다리는 가구 ID(기숙사 밖에서 눌렀으면 기숙사에 들어갈 때 이어서 고른다) */
let pendingPlacement: string | null = null

/**
 * 가구 배치를 요청한다. 기숙사 장면이 열려 있으면 바로, 아니면 기숙사에 들어갈 때 시작한다.
 *
 * @param id 놓을 가구 ID
 */
export function requestPlacement(id: string) {
  pendingPlacement = id
  window.dispatchEvent(new CustomEvent(DORM_PLACE_EVENT, { detail: id }))
}

/**
 * 기다리던 배치 요청을 꺼낸다(한 번만).
 *
 * @returns 가구 ID 또는 null
 */
export function takePlacement(): string | null {
  const id = pendingPlacement
  pendingPlacement = null
  return id
}

export const FLOOR ={ left: 24, right: 776, top: 64, bottom: 576 }
export const DOOR = { left: 340, right: 460, top: 470 }

export const FURNITURE_ICONS: Record<string, string> = {
  BED: '🛏️', DESK: '🗄️', COMPUTER: '🖥️', CHAIR: '🪑', ARMCHAIR: '💺', SOFA: '🛋️', BOOKSHELF: '📚', PLANT: '🪴',
  TALL_PLANT: '🌿', LAMP: '💡', WHITEBOARD: '📋', COFFEE_MACHINE: '☕', ARCADE: '🕹️', RUG: '🟫',
}

/* 상태 코드별 안내를 붙여 요청한다. */
async function request(path: string, body?: unknown, messages: Record<number, string> = {}): Promise<DormView> {
  const response = await fetch(path, body === undefined ? { headers: { Accept: 'application/json' } }
    : { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) {
    throw new Error(messages[response.status] ?? (response.status === 401 ? '로그인한 연구원만 쓸 수 있어요.'
      : response.status === 429 ? '잠시 후 다시 시도해 주세요.' : '요청에 실패했어요.'))
  }
  return await response.json() as DormView
}

const changed = (view: DormView) => { window.dispatchEvent(new CustomEvent(DORM_CHANGED_EVENT)); return view }

export const fetchDorm = () => request('/api/dorm')
export const buyFurniture = (code: string) => request('/api/dorm/buy', { code }, { 404: '없는 가구예요.', 409: '동전이 모자라거나 가구가 너무 많아요(최대 60개).' }).then(changed)
export const placeFurniture = (id: string, x: number, y: number) => request('/api/dorm/place', { id, x, y },
  { 404: '내 가구가 아니에요.', 409: '여기에는 놓을 수 없어요.', get 423() { return tiredMessage('FURNITURE_PLACE') } })
  .then(view => { void inventoryStore.refresh(); return changed(view) })

/** 침대 휴식 결과(서버 RestDTO) */
export type RestResult = { recovered: boolean; hp: number; hpMax: number; fatigue: number; fatigueMax: number; everySec: number; hpGain: number; fatigueGain: number; unlimited: boolean }

/**
 * 놓인 침대에서 쉰다. 간격(everySec)마다 한 번 HP·기력이 오르고, 간격은 서버가 지킨다.
 * @returns 휴식 결과
 */
export async function restInBed(): Promise<RestResult> {
  const response = await fetch('/api/dorm/rest', { method: 'POST', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(response.status === 401 ? '로그인한 연구원만 쉴 수 있어요.' : response.status === 409 ? '먼저 침대를 놓아 주세요.' : '쉬지 못했어요.')
  const result = await response.json() as RestResult
  if (result.recovered) void inventoryStore.refresh()
  return result
}
export const storeFurniture = (id: string) => request('/api/dorm/store', { id }, { 404: '내 가구가 아니에요.' }).then(changed)

/**
 * 가구 바닥이 벽 안쪽이고(부딪히는 가구면) 문 앞을 막지 않는지 본다.
 *
 * @param shape 가구 모양
 * @param x 바닥 가운데 x
 * @param y 바닥 아래 끝 y
 * @returns 놓을 수 있으면 true
 */
export function fits(shape: Furniture, x: number, y: number): boolean {
  const left = x - Math.trunc(shape.width / 2), right = x + Math.trunc(shape.width / 2), top = y - shape.height
  if (left < FLOOR.left || right > FLOOR.right || top < FLOOR.top || y > FLOOR.bottom) return false
  return !shape.blocking || !(right > DOOR.left && left < DOOR.right && y > DOOR.top)
}

/**
 * 두 가구의 바닥 사각형이 겹치는지 본다.
 *
 * @returns 겹치면 true
 */
export function overlaps(a: Furniture, ax: number, ay: number, b: Furniture, bx: number, by: number): boolean {
  return Math.abs(ax - bx) * 2 < a.width + b.width && ay - a.height < by && by - b.height < ay
}

/**
 * 이 자리에 가구를 놓을 수 있는지(서버와 같은 규칙).
 *
 * @param view 기숙사 값
 * @param id 놓을 가구 ID
 * @param x 바닥 가운데 x
 * @param y 바닥 아래 끝 y
 * @returns 놓을 수 있으면 true
 */
export function canPlace(view: DormView, id: string, x: number, y: number): boolean {
  const item = view.furniture.find(entry => entry.id === id)
  const shape = item && view.catalog.find(entry => entry.code === item.code)
  if (!shape || !fits(shape, x, y)) return false
  if (!shape.blocking) return true
  return !view.furniture.some(other => {
    const otherShape = view.catalog.find(entry => entry.code === other.code)
    return other.placed && other.id !== id && !!otherShape?.blocking && overlaps(shape, x, y, otherShape, other.x ?? 0, other.y ?? 0)
  })
}
